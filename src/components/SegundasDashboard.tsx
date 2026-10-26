import { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp,
  Layers, Search, FileSpreadsheet, FileText, Plus, X, Edit2, Trash2,
  BarChart3, RotateCcw, Upload, Eye, Activity, ArrowUpDown,
  Calendar, ChevronLeft, ChevronRight, GitCompare, Check, Zap,
  SlidersHorizontal, CheckSquare, Square, LayoutGrid, Table2,
  Award, ArrowDownWideNarrow, ArrowUpNarrowWide, EyeOff,
  Scissors, AlertCircle, Factory, Info, Droplets, Boxes, Sparkles,
  ArrowUpRight, ArrowDownRight, Download, FileDown, Filter,
  ChevronDown, Clock, ShieldCheck, Printer, Image as LucideImage,
  PieChart as LucidePieChart, Palette, Cloud
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, ComposedChart, Line,
  PieChart, Pie, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SegundasRecord } from '../types';
import { 
  loadSegundasRecords, 
  saveSegundasRecords, 
  saveSegundasRecordsToCloud,
  deleteSegundasRecordCloud,
  resetSegundasRecordsCloud,
  subscribeToSegundasRecords,
  INITIAL_SEGUNDAS_RECORDS, 
  SEPTIEMBRE_SEGUNDAS_RECORDS,
  OCTUBRE_SEGUNDAS_RECORDS,
  inferTecnica, 
  detectSegundasExcelColumns 
} from '../lib/segundasData';
import { SegundasReportModal } from './SegundasReportModal';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DESIGN_COLORS = [
  '#0ea5e9', // Sky (Azul cielo)
  '#6366f1', // Indigo (Morado índigo)
  '#10b981', // Emerald (Verde esmeralda)
  '#f59e0b', // Amber (Ámbar)
  '#ec4899', // Pink (Rosa)
  '#14b8a6', // Teal (Turquesa)
  '#ef4444', // Red (Rojo)
  '#8b5cf6', // Violet (Violeta)
  '#84cc16', // Lime (Verde lima)
  '#f97316', // Orange (Naranja)
];

const DEFECT_COLORS = [
  '#ef4444', // Manchas
  '#f97316', // Falta Pintura
  '#f59e0b', // Repise
  '#8b5cf6', // Grasa
  '#3b82f6', // Penetración
  '#06b6d4', // Descases
  '#ec4899', // Quemadas
  '#64748b', // Logos Corridos
];

const REF_COLORS: Record<string, string> = {
  'C280T': '#3b82f6',  // Azul
  'ME1002': '#8b5cf6', // Morado
  'ML1002': '#f59e0b', // Ámbar
};

const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('es-CO');
const fmtPct = (n: number, d = 2) => `${((n || 0) * 100).toFixed(d)}%`;

export function normalizeExcelDate(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    // Serial number de Excel (días desde 1899-12-30)
    const utcDays = Math.round(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const clean = s.split('T')[0];
  const parts = clean.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

export function getRecordFingerprint(r: SegundasRecord): string {
  const f = normalizeExcelDate(r.fecha);
  const d = (r.diseno || '').trim().toUpperCase();
  const ref = (r.referencia || '').trim().toUpperCase();
  const rev = Number(r.cantTotalRevisada || 0);
  const ok = Number(r.cantBuena || 0);
  const col = (r.color || '').trim().toUpperCase();
  const revs = (r.revisadoras || '').trim().toUpperCase();
  return `${f}|${d}|${ref}|${col}|${rev}|${ok}|${revs}`;
}

function getTopDefect(r: SegundasRecord): { name: string; count: number } | null {
  if (!r.defectosEstampado) return null;
  const list = [
    { name: 'Manchas', count: r.defectosEstampado.manchas },
    { name: 'Falta Pintura', count: r.defectosEstampado.faltaPintura },
    { name: 'Repise', count: r.defectosEstampado.repise },
    { name: 'Grasa', count: r.defectosEstampado.grasa },
    { name: 'Penetración', count: r.defectosEstampado.penetracion },
    { name: 'Descases', count: r.defectosEstampado.descases },
    { name: 'Quemadas', count: r.defectosEstampado.quemadas },
    { name: 'Logos Corridos', count: r.defectosEstampado.logosCorridos },
  ].filter(d => d.count > 0);
  list.sort((a, b) => b.count - a.count);
  return list[0] || null;
}

function getDefectsSummary(r: SegundasRecord): string {
  if (!r.defectosEstampado) return 'Sin defectos';
  const list = [
    r.defectosEstampado.manchas ? `Manchas: ${r.defectosEstampado.manchas}` : null,
    r.defectosEstampado.faltaPintura ? `Pintura: ${r.defectosEstampado.faltaPintura}` : null,
    r.defectosEstampado.repise ? `Repise: ${r.defectosEstampado.repise}` : null,
    r.defectosEstampado.grasa ? `Grasa: ${r.defectosEstampado.grasa}` : null,
    r.defectosEstampado.penetracion ? `Penetración: ${r.defectosEstampado.penetracion}` : null,
    r.defectosEstampado.descases ? `Descases: ${r.defectosEstampado.descases}` : null,
    r.defectosEstampado.quemadas ? `Quemadas: ${r.defectosEstampado.quemadas}` : null,
    r.defectosEstampado.logosCorridos ? `Logos: ${r.defectosEstampado.logosCorridos}` : null,
  ].filter(Boolean);
  return list.join(' · ') || 'Sin defectos';
}

function getTopTintoreriaDefect(r: SegundasRecord): { name: string; count: number } | null {
  const d = r.defectosTintoreria;
  if (!d) {
    const tot = r.totalTintoreria || 0;
    return tot > 0 ? { name: 'Tintorería', count: tot } : null;
  }
  const list = [
    { name: 'Mancha Tinta', count: d.manchaTintoreria || 0 },
    { name: 'Óxido', count: d.manchaOxido || 0 },
    { name: 'Arrastre', count: d.arrastreBarca || 0 },
    { name: 'Sucias', count: d.sucias || 0 },
    { name: 'Vetas', count: d.vetas || 0 },
    { name: 'Medida', count: d.medida || 0 },
    { name: 'Rama', count: d.rama || 0 },
    { name: 'Grasa', count: d.grasa || 0 },
  ].filter(x => x.count > 0);
  list.sort((a, b) => b.count - a.count);
  if (list.length > 0) return list[0];
  const tot = d.totalTintoreria || r.totalTintoreria || 0;
  return tot > 0 ? { name: 'Falla Tint.', count: tot } : null;
}

function getTopTejeduriaDefect(r: SegundasRecord): { name: string; count: number } | null {
  const d = r.defectosTejeduria;
  if (!d) {
    const tot = r.totalTejeduria || 0;
    return tot > 0 ? { name: 'Tejeduría', count: tot } : null;
  }
  const list = [
    { name: 'Urdimbre', count: d.revienteUrdimbre || 0 },
    { name: 'Trama', count: d.revienteTrama || 0 },
    { name: 'Marra', count: d.marra || 0 },
    { name: 'Rayas', count: d.rayas || 0 },
    { name: 'Var. Rizo', count: d.variacionesRizo || 0 },
    { name: 'Hilo Contam.', count: d.hiloContaminado || 0 },
    { name: 'Orillos', count: d.orillosLaterales || 0 },
  ].filter(x => x.count > 0);
  list.sort((a, b) => b.count - a.count);
  if (list.length > 0) return list[0];
  const tot = d.totalTejeduria || r.totalTejeduria || 0;
  return tot > 0 ? { name: 'Falla Tejed.', count: tot } : null;
}

export interface ImportAuditStatus {
  fileName: string;
  uploadDate: string;
  sheetName: string;
  totalRowsRead: number;
  validRecordsCount: number;
  newRecordsCount: number;
  duplicatesCount: number;
  detectedMonths: { label: string; count: number }[];
  columnsDetected: { name: string; col: string; status: 'ok' | 'missing' | 'warning'; note?: string }[];
  allColumnsValid: boolean;
  status: 'success' | 'warning' | 'error';
}

export interface ReprocesoModalState {
  type: 'cabeceras' | 'laterales' | 'pegas' | 'estampado' | 'tintoreria' | 'tejeduria' | 'tundido' | 'montadas' | 'manchas_negras' | 'rotas';
  title: string;
  subtitle: string;
  badgeColor: string;
}

export default function SegundasDashboard() {
  const [records, setRecords] = useState<SegundasRecord[]>(() => loadSegundasRecords());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(true);
  const [subView, setSubView] = useState<'resumen' | 'fallas_ref' | 'planilla' | 'pareto'>('resumen');

  // ── Sincronización en tiempo real con Firebase Firestore (Vercel, Localhost, Móviles) ──
  useEffect(() => {
    const unsub = subscribeToSegundasRecords((cloudRecords) => {
      setRecords(cloudRecords);
      setIsCloudSyncing(false);
    });
    return () => unsub();
  }, []);
  
  // ── Filtros de Tiempo y Selección ──
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'year' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [tecnicaFilter, setTecnicaFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [referenciaFilter, setReferenciaFilter] = useState<string>('all'); // Base de tela (C280T, ME1002, ML1002)
  const [disenoFilter, setDisenoFilter] = useState<string>('all'); // Diseño (Referencia en el taller)
  const [monthlyComparisonScope, setMonthlyComparisonScope] = useState<'filtered' | 'all'>('filtered');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // ── Estados de la Vista Diagnóstico de Fallas por Diseño (Referencia) ──
  const [fallasProcess, setFallasProcess] = useState<'estampado' | 'tintoreria' | 'tejeduria' | 'costura' | 'todos'>('estampado');
  const [fallasDesignSearch, setFallasDesignSearch] = useState<string>('');
  const [fallasViewMode, setFallasViewMode] = useState<'cards' | 'chart' | 'matrix'>('cards');
  const [fallasSortBy, setFallasSortBy] = useState<'fallas' | 'revisadas' | 'pct' | 'nombre'>('fallas');
  const [showTelaComparison, setShowTelaComparison] = useState<boolean>(false);

  // ── Estados de Top Diseños Dinámico (Debajo del Gráfico de Comparativa) ──
  const [topDesignMetric, setTopDesignMetric] = useState<'segundas' | 'estampado' | 'revisadas' | 'pctSegundas'>('segundas');
  const [topDesignLimit, setTopDesignLimit] = useState<number>(10);
  const [topDesignSortOrder, setTopDesignSortOrder] = useState<'desc' | 'asc'>('desc');
  const [topDesignSearch, setTopDesignSearch] = useState<string>('');
  const [topDesignProcessFilter, setTopDesignProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [topDesignRiskFilter, setTopDesignRiskFilter] = useState<'all' | 'critical' | 'warning' | 'normal'>('all');
  const [topDesignFabricFilter, setTopDesignFabricFilter] = useState<string>('all');
  const [isPredictiveSearchOpen, setIsPredictiveSearchOpen] = useState<boolean>(false);
  const [activeDatePreset, setActiveDatePreset] = useState<'none' | 'week' | 'quincena_1' | 'quincena_2' | 'month' | 'prev_month' | 'compare_prev'>('none');
  const [hiddenTopDesigns, setHiddenTopDesigns] = useState<string[]>([]);
  const [isDesignManagerOpen, setIsDesignManagerOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalProcessFilter, setModalProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');

  // Filtros de Planilla y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'optimo' | 'alerta' | 'critico'>('all');
  const [sortBy, setSortBy] = useState<'fecha' | 'revisadas' | 'pctEstampado' | 'tintoreria' | 'tejeduria' | 'totalSegundas'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [comparativaGrouping, setComparativaGrouping] = useState<'dia' | 'diseno'>('dia');
  const [showAllDefectColumns, setShowAllDefectColumns] = useState<boolean>(false);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SegundasRecord | null>(null);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<SegundasRecord | null>(null);

  // ── Feedback y Notificaciones Visuales (Reemplazo moderno de alert) ──
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message?: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = String(Date.now());
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast(curr => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // ── Estado del Modal de Carga Periódica (Acumular Historial vs Reemplazar) ──
  const [importPending, setImportPending] = useState<{
    fileName: string;
    importedRecords: SegundasRecord[];
    detectedMonths: { key: string; label: string; count: number; month: number; year: number }[];
    newRecords: SegundasRecord[];
    duplicatesCount: number;
  } | null>(null);

  // ── Panel Lateral / Drawer de Auditoría de Carga Excel ──
  const [isImportAuditDrawerOpen, setIsImportAuditDrawerOpen] = useState<boolean>(false);
  const [lastImportAudit, setLastImportAudit] = useState<ImportAuditStatus>(() => {
    try {
      const saved = localStorage.getItem('contex_segundas_import_audit');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      fileName: 'Base_Procesos_Calidad.xlsx',
      uploadDate: new Date().toISOString(),
      sheetName: 'Planilla_Calidad',
      totalRowsRead: 1250,
      validRecordsCount: 1250,
      newRecordsCount: 1250,
      duplicatesCount: 0,
      detectedMonths: [
        { label: 'Septiembre 2026', count: 480 },
        { label: 'Agosto 2026', count: 420 },
        { label: 'Julio 2026', count: 350 }
      ],
      columnsDetected: [
        { name: 'Fecha de Inspección', col: 'Col A (0)', status: 'ok', note: 'Fechas válidas en formato ISO/Excel' },
        { name: 'Revisadoras / Auditor', col: 'Col B (1)', status: 'ok', note: 'Auditores registrados' },
        { name: 'Referencia de Tela Base', col: 'Col E (4)', status: 'ok', note: 'C280T, ME1002, ML1002' },
        { name: 'Diseño / Referencia Taller', col: 'Col G (6)', status: 'ok', note: 'Asignación de técnica reactivo/pigmento' },
        { name: 'Cantidad Total Revisada', col: 'Col I (8)', status: 'ok', note: 'Valores enteros validados' },
        { name: '1ª Calidad (Buenas)', col: 'Col J (9)', status: 'ok', note: 'Valores enteros validados' },
        { name: 'Pegas (Empalmes en rollo)', col: 'Col K (10)', status: 'ok', note: 'Separadas de segundas' },
        { name: 'Arreglos Laterales (Orillos)', col: 'Col L (11)', status: 'ok', note: 'Reproceso registrado' },
        { name: 'Arreglos Cabeceras (Dobladillo)', col: 'Col N (13)', status: 'ok', note: 'Reproceso registrado' },
        { name: 'Defectos de Estampado (8 tipos)', col: 'Cols Q-X (16-23)', status: 'ok', note: 'Manchas, repise, falta pintura, etc.' },
      ],
      allColumnsValid: true,
      status: 'success'
    };
  });

  // ── Modal de Desglose de Lotes para Arreglos y Reprocesos ──
  const [reprocesoModal, setReprocesoModal] = useState<ReprocesoModalState | null>(null);
  const [reprocesoModalSearch, setReprocesoModalSearch] = useState<string>('');
  const [reprocesoModalRef, setReprocesoModalRef] = useState<string>('all');
  const [reprocesoModalSort, setReprocesoModalSort] = useState<'defects_desc' | 'date_desc'>('defects_desc');

  // Form State
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formRevisadoras, setFormRevisadoras] = useState('');
  const [formReferencia, setFormReferencia] = useState('');
  const [formDimensiones, setFormDimensiones] = useState('');
  const [formDiseno, setFormDiseno] = useState('');
  const [formColor, setFormColor] = useState('EST');
  const [formTecnica, setFormTecnica] = useState<'REACTIVO' | 'PIGMENTO'>('REACTIVO');
  const [formTotalRevisada, setFormTotalRevisada] = useState<number>(1000);
  const [formCantBuena, setFormCantBuena] = useState<number>(850);
  const [formPegas, setFormPegas] = useState<number>(30);
  const [formArrLat, setFormArrLat] = useState<number>(50);
  const [formArrCab, setFormArrCab] = useState<number>(40);
  const [formManchas, setFormManchas] = useState<number>(15);
  const [formRepise, setFormRepise] = useState<number>(5);
  const [formFaltaPintura, setFormFaltaPintura] = useState<number>(5);
  const [formLogosCorridos, setFormLogosCorridos] = useState<number>(0);
  const [formPenetracion, setFormPenetracion] = useState<number>(2);
  const [formGrasa, setFormGrasa] = useState<number>(2);
  const [formDescases, setFormDescases] = useState<number>(1);
  const [formQuemadas, setFormQuemadas] = useState<number>(0);
  const [formObservaciones, setFormObservaciones] = useState('');

  const updateRecords = (newRecords: SegundasRecord[]) => {
    setRecords(newRecords);
    saveSegundasRecords(newRecords);
    saveSegundasRecordsToCloud(newRecords);
  };

  // Navegación de meses
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

  // Lista única de telas base en los datos (C280T, ME1002, ML1002)
  const availableReferences = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.referencia) set.add(r.referencia.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [records]);

  // Lista única de Diseños (Referencias de taller) en los datos
  const availableDisenos = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.diseno) set.add(r.diseno.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [records]);

  // ── Meses disponibles con datos en todo el historial acumulado ──
  const availableMonthsInRecords = useMemo(() => {
    const map: Record<string, { label: string; month: number; year: number; count: number }> = {};
    records.forEach(r => {
      const f = normalizeExcelDate(r.fecha);
      const parts = f.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
          const key = `${y}-${m}`;
          if (!map[key]) {
            map[key] = { label: `${MONTH_NAMES[m]} ${y}`, month: m, year: y, count: 0 };
          }
          map[key].count++;
        }
      }
    });
    return Object.values(map).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  }, [records]);

  // ── FILTRADO POR TIEMPO, TÉCNICA, DISEÑO Y TELA BASE ──
  const timeFilteredRecords = useMemo(() => {
    return records.filter(r => {
      // Filtro de técnica
      const tecnica = r.tecnica || inferTecnica(r.diseno, r.referencia);
      if (tecnicaFilter !== 'all' && tecnica !== tecnicaFilter) return false;

      // Filtro de tela base (referencia textil: C280T, ME1002, ML1002)
      if (referenciaFilter !== 'all' && (r.referencia || '').trim().toUpperCase() !== referenciaFilter.toUpperCase()) return false;

      // Filtro de diseño (referencia de taller: C MINNIE, NAVIDAD ANDU, etc.)
      if (disenoFilter !== 'all' && (r.diseno || '').trim().toUpperCase() !== disenoFilter.toUpperCase()) return false;

      // Filtro de tiempo
      if (timeFilter === 'all') return true;

      if (!r.fecha) return false;
      const normalized = normalizeExcelDate(r.fecha);

      if (timeFilter === 'range') {
        if (startDate && normalized < startDate) return false;
        if (endDate && normalized > endDate) return false;
        return true;
      }

      const parts = normalized.split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed

      if (timeFilter === 'year') {
        return y === selectedYear;
      }
      if (timeFilter === 'month') {
        return y === selectedYear && m === selectedMonth;
      }

      return true;
    });
  }, [records, timeFilter, selectedMonth, selectedYear, startDate, endDate, tecnicaFilter, referenciaFilter, disenoFilter]);

  // ── Registros activos (excluyendo diseños ocultos en el Top) ──
  // Afecta a: Gráfica comparativa, KPIs, Matriz Pareto y Diagnóstico de fallas
  const visibleRecords = useMemo(() => {
    if (hiddenTopDesigns.length === 0) return timeFilteredRecords;
    const hiddenSet = new Set(hiddenTopDesigns.map(s => s.trim().toUpperCase()));
    return timeFilteredRecords.filter(r => !hiddenSet.has((r.diseno || '').trim().toUpperCase()));
  }, [timeFilteredRecords, hiddenTopDesigns]);

  // Cálculos Ejecutivos Globales del periodo seleccionado
  const totals = useMemo(() => {
    return visibleRecords.reduce(
      (acc, r) => {
        acc.revisada += r.cantTotalRevisada || 0;
        acc.buena += r.cantBuena || 0;
        acc.pegas += r.pegas || 0;
        acc.arreLaterales += r.arreLaterales || 0;
        acc.arreCabeceras += r.arreCabeceras || 0;
        acc.estampado += r.defectosEstampado?.totalEstampado || 0;
        acc.manchas += r.defectosEstampado?.manchas || 0;
        acc.repise += r.defectosEstampado?.repise || 0;
        acc.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
        acc.logosCorridos += r.defectosEstampado?.logosCorridos || 0;
        acc.penetracion += r.defectosEstampado?.penetracion || 0;
        acc.grasa += r.defectosEstampado?.grasa || 0;
        acc.descases += r.defectosEstampado?.descases || 0;
        acc.quemadas += r.defectosEstampado?.quemadas || 0;

        const tint = r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0;
        const tej = r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0;
        const cost = r.defectosCostura?.totalCostura ?? r.totalCostura ?? 0;
        const rot = r.rotas ?? 0;

        const tundido = r.defectosCostura?.tundidoCaido ?? 0;
        const montadas = r.defectosCostura?.montadasCostura ?? 0;
        const manchasNegras = (r.defectosCostura?.manchasNegras ?? 0) + (r.defectosCostura?.enganches ?? 0);

        acc.tintoreria += tint;
        acc.tejeduria += tej;
        acc.costura += cost;
        acc.tundido += tundido;
        acc.montadas += montadas;
        acc.manchasNegras += manchasNegras;
        acc.rotas += rot;
        
        const est = r.defectosEstampado?.totalEstampado || 0;
        const arreglos = (r.arreLaterales || 0) + (r.arreCabeceras || 0);
        const otros = (tint + tej + cost + rot > 0)
          ? (tint + tej + cost + rot)
          : Math.max(0, (r.cantTotalRevisada || 0) - ((r.cantBuena || 0) + (r.pegas || 0) + arreglos + est));
        acc.segundasOtrosProcesos += otros;

        // Segundas = Defectos de estampado + Segundas de otros procesos (Arreglos y pegas quedan FUERA)
        const seg = r.totalSegundas !== undefined ? r.totalSegundas : (est + otros);
        acc.totalSegundas += seg;

        const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
        if (tec === 'REACTIVO') {
          acc.reactivoRevisada += r.cantTotalRevisada || 0;
          acc.reactivoBuenas += r.cantBuena || 0;
          acc.reactivoSegundas += seg;
        } else {
          acc.pigmentoRevisada += r.cantTotalRevisada || 0;
          acc.pigmentoBuenas += r.cantBuena || 0;
          acc.pigmentoSegundas += seg;
        }

        return acc;
      },
      {
        revisada: 0,
        buena: 0,
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        estampado: 0,
        manchas: 0,
        repise: 0,
        faltaPintura: 0,
        logosCorridos: 0,
        penetracion: 0,
        grasa: 0,
        descases: 0,
        quemadas: 0,
        tintoreria: 0,
        tejeduria: 0,
        costura: 0,
        tundido: 0,
        montadas: 0,
        manchasNegras: 0,
        rotas: 0,
        segundasOtrosProcesos: 0,
        totalSegundas: 0,
        reactivoRevisada: 0,
        reactivoBuenas: 0,
        reactivoSegundas: 0,
        pigmentoRevisada: 0,
        pigmentoBuenas: 0,
        pigmentoSegundas: 0,
      }
    );
  }, [visibleRecords]);

  // Segundas generadas en otros procesos (Tintorería, Tejeduría, Costura, etc.)
  const segundasOtrosProcesos = totals.segundasOtrosProcesos;
  const pctGlobalBuena = totals.revisada > 0 ? totals.buena / totals.revisada : 0;
  const pctGlobalSegundas = totals.revisada > 0 ? totals.totalSegundas / totals.revisada : 0;
  const pctGlobalOtrosProcesos = totals.revisada > 0 ? segundasOtrosProcesos / totals.revisada : 0;
  const pctGlobalEstampado = totals.revisada > 0 ? totals.estampado / totals.revisada : 0;
  const pctGlobalTintoreria = totals.revisada > 0 ? totals.tintoreria / totals.revisada : 0;
  const pctGlobalTejeduria = totals.revisada > 0 ? totals.tejeduria / totals.revisada : 0;
  const pctGlobalCostura = totals.revisada > 0 ? totals.costura / totals.revisada : 0;
  const pctGlobalTundido = totals.revisada > 0 ? totals.tundido / totals.revisada : 0;
  const pctGlobalMontadas = totals.revisada > 0 ? totals.montadas / totals.revisada : 0;
  const pctGlobalManchasNegras = totals.revisada > 0 ? totals.manchasNegras / totals.revisada : 0;
  const pctGlobalRotas = totals.revisada > 0 ? totals.rotas / totals.revisada : 0;
  const pctGlobalLaterales = totals.revisada > 0 ? totals.arreLaterales / totals.revisada : 0;
  const pctGlobalCabeceras = totals.revisada > 0 ? totals.arreCabeceras / totals.revisada : 0;
  const pctGlobalPegas = totals.revisada > 0 ? totals.pegas / totals.revisada : 0;
  const pctArreglosTotal = totals.revisada > 0 ? (totals.arreLaterales + totals.arreCabeceras) / totals.revisada : 0;

  // Datos para el gráfico de pastel de volumen por técnica
  const tecnicaPieData = useMemo(() => {
    const total = totals.revisada || 1;
    const rPct = (totals.reactivoRevisada / total) * 100;
    const pPct = (totals.pigmentoRevisada / total) * 100;
    return [
      { name: 'Reactivo', value: totals.reactivoRevisada, color: '#8b5cf6', pct: rPct, segundas: totals.reactivoSegundas, buenas: totals.reactivoBuenas },
      { name: 'Pigmento', value: totals.pigmentoRevisada, color: '#f59e0b', pct: pPct, segundas: totals.pigmentoSegundas, buenas: totals.pigmentoBuenas }
    ];
  }, [totals.reactivoRevisada, totals.pigmentoRevisada, totals.reactivoSegundas, totals.pigmentoSegundas, totals.reactivoBuenas, totals.pigmentoBuenas, totals.revisada]);

  // ── DESGLOSE Y DIAGNÓSTICO DE FALLAS POR REFERENCIA ──
  const defectsByReference = useMemo(() => {
    const map = new Map<string, {
      referencia: string;
      dimensiones: string;
      tecnica: string;
      totalRevisadas: number;
      totalBuenas: number;
      totalSegundas: number;
      totalEstampado: number;
      manchas: number;
      faltaPintura: number;
      repise: number;
      grasa: number;
      penetracion: number;
      descases: number;
      quemadas: number;
      logosCorridos: number;
      pegas: number;
      arreLaterales: number;
      arreCabeceras: number;
      disenos: string[];
      topDefectoEstampado: string;
      topDefectoEstampadoCant: number;
      topDefectoPct: number;
    }>();

    visibleRecords.forEach(r => {
      const ref = r.referencia || 'Sin Ref';
      const existing = map.get(ref) || {
        referencia: ref,
        dimensiones: r.dimensiones || '',
        tecnica: r.tecnica || inferTecnica(r.diseno, r.referencia),
        totalRevisadas: 0,
        totalBuenas: 0,
        totalSegundas: 0,
        totalEstampado: 0,
        manchas: 0,
        faltaPintura: 0,
        repise: 0,
        grasa: 0,
        penetracion: 0,
        descases: 0,
        quemadas: 0,
        logosCorridos: 0,
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        disenos: [],
        topDefectoEstampado: '',
        topDefectoEstampadoCant: 0,
        topDefectoPct: 0
      };

      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.totalBuenas += r.cantBuena || 0;
      existing.totalSegundas += r.totalSegundas || 0;
      existing.totalEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.manchas += r.defectosEstampado?.manchas || 0;
      existing.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
      existing.repise += r.defectosEstampado?.repise || 0;
      existing.grasa += r.defectosEstampado?.grasa || 0;
      existing.penetracion += r.defectosEstampado?.penetracion || 0;
      existing.descases += r.defectosEstampado?.descases || 0;
      existing.quemadas += r.defectosEstampado?.quemadas || 0;
      existing.logosCorridos += r.defectosEstampado?.logosCorridos || 0;
      existing.pegas += r.pegas || 0;
      existing.arreLaterales += r.arreLaterales || 0;
      existing.arreCabeceras += r.arreCabeceras || 0;

      if (r.diseno && !existing.disenos.includes(r.diseno)) {
        existing.disenos.push(r.diseno);
      }

      map.set(ref, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalRevisadas - a.totalRevisadas)
      .map(item => {
        const defects = [
          { name: 'Manchas', cant: item.manchas },
          { name: 'Falta Pintura', cant: item.faltaPintura },
          { name: 'Repise', cant: item.repise },
          { name: 'Grasa', cant: item.grasa },
          { name: 'Penetración', cant: item.penetracion },
          { name: 'Descases', cant: item.descases },
          { name: 'Quemadas', cant: item.quemadas },
          { name: 'Logos Corridos', cant: item.logosCorridos },
        ].sort((a, b) => b.cant - a.cant);

        const top = defects[0] || { name: 'Sin defectos', cant: 0 };
        const pct = item.totalEstampado > 0 ? (top.cant / item.totalEstampado) * 100 : 0;

        return {
          ...item,
          topDefectoEstampado: top.name,
          topDefectoEstampadoCant: top.cant,
          topDefectoPct: Number(pct.toFixed(1))
        };
      });
  }, [visibleRecords]);

  // Gráfico de tipos de fallas comparando referencias
  const fallasPorRefChartData = useMemo(() => {
    return [
      {
        tipo: 'Manchas',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.manchas]))
      },
      {
        tipo: 'Falta Pintura',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.faltaPintura]))
      },
      {
        tipo: 'Repise',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.repise]))
      },
      {
        tipo: 'Grasa',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.grasa]))
      },
      {
        tipo: 'Penetración',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.penetracion]))
      },
      {
        tipo: 'Descases',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.descases]))
      },
      {
        tipo: 'Quemadas',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.quemadas]))
      },
      {
        tipo: 'Logos Corridos',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.logosCorridos]))
      },
    ];
  }, [defectsByReference]);

  // ── CONFIGURACIONES Y ESPECIFICACIONES DE PROCESOS PARA DIAGNÓSTICO DE FALLAS ──
  type FallasProcessKey = 'estampado' | 'tintoreria' | 'tejeduria' | 'costura' | 'todos';

  const PROCESS_CONFIG: Record<FallasProcessKey, {
    label: string;
    badgeLabel: string;
    unitLabel: string;
    colorName: string;
    activeBtnClass: string;
    headerIconColor: string;
    borderHoverClass: string;
    cardPredominanteBg: string;
    cardPredominanteBorder: string;
    cardPredominanteText: string;
    barColor: string;
    emptyText: string;
    defectsSummary: string;
  }> = {
    estampado: {
      label: 'Estampado',
      badgeLabel: 'Estampación',
      unitLabel: 'fallas de estampado',
      colorName: 'rose',
      activeBtnClass: 'bg-rose-600 text-white shadow-xs font-black',
      headerIconColor: 'text-rose-600',
      borderHoverClass: 'hover:border-rose-300',
      cardPredominanteBg: 'bg-rose-50/90',
      cardPredominanteBorder: 'border-rose-200',
      cardPredominanteText: 'text-rose-700',
      barColor: 'bg-rose-600',
      emptyText: '100% Sin Fallas de Estampación',
      defectsSummary: 'Falta de Pintura, Manchas, Repise, Grasa, Penetración, Descases, Quemadas, Logos',
    },
    tintoreria: {
      label: 'Tintorería',
      badgeLabel: 'Tintorería',
      unitLabel: 'fallas de tintorería',
      colorName: 'cyan',
      activeBtnClass: 'bg-cyan-600 text-white shadow-xs font-black',
      headerIconColor: 'text-cyan-600',
      borderHoverClass: 'hover:border-cyan-300',
      cardPredominanteBg: 'bg-cyan-50/90',
      cardPredominanteBorder: 'border-cyan-200',
      cardPredominanteText: 'text-cyan-800',
      barColor: 'bg-cyan-600',
      emptyText: '100% Sin Fallas de Tintorería',
      defectsSummary: 'Manchas Tintorería, Óxido, Arrastre Barca, Sucias, Vetas, Medida, Rama, Grasa',
    },
    tejeduria: {
      label: 'Tejeduría',
      badgeLabel: 'Tejeduría',
      unitLabel: 'fallas de tejeduría',
      colorName: 'emerald',
      activeBtnClass: 'bg-emerald-600 text-white shadow-xs font-black',
      headerIconColor: 'text-emerald-600',
      borderHoverClass: 'hover:border-emerald-300',
      cardPredominanteBg: 'bg-emerald-50/90',
      cardPredominanteBorder: 'border-emerald-200',
      cardPredominanteText: 'text-emerald-800',
      barColor: 'bg-emerald-600',
      emptyText: '100% Sin Fallas de Tejeduría',
      defectsSummary: 'Reviente Trama, Reviente Urdimbre, Marra, Rayas, Variaciones Rizo, Hilo Contaminado, Orillos',
    },
    costura: {
      label: 'Costura / Confección',
      badgeLabel: 'Costura',
      unitLabel: 'fallas de costura',
      colorName: 'purple',
      activeBtnClass: 'bg-purple-600 text-white shadow-xs font-black',
      headerIconColor: 'text-purple-600',
      borderHoverClass: 'hover:border-purple-300',
      cardPredominanteBg: 'bg-purple-50/90',
      cardPredominanteBorder: 'border-purple-200',
      cardPredominanteText: 'text-purple-800',
      barColor: 'bg-purple-600',
      emptyText: '100% Sin Fallas de Costura',
      defectsSummary: 'Tundido Caído, Montadas, Manchas Negras, Enganches',
    },
    todos: {
      label: 'Consolidado General',
      badgeLabel: 'Multiproceso',
      unitLabel: 'segundas totales',
      colorName: 'blue',
      activeBtnClass: 'bg-slate-900 text-white shadow-xs font-black',
      headerIconColor: 'text-blue-600',
      borderHoverClass: 'hover:border-blue-300',
      cardPredominanteBg: 'bg-slate-50',
      cardPredominanteBorder: 'border-slate-200',
      cardPredominanteText: 'text-slate-800',
      barColor: 'bg-blue-600',
      emptyText: '100% Sin Segundas Registradas',
      defectsSummary: 'Estampado, Tintorería, Tejeduría y Costura unificados',
    },
  };

  const PROCESS_DEFECT_SPECS: Record<FallasProcessKey, { key: string; name: string; shortName: string; color: string; bgClass: string; textClass: string }[]> = {
    estampado: [
      { key: 'manchas', name: 'Manchas', shortName: 'Manchas', color: '#ef4444', bgClass: 'bg-red-50/50', textClass: 'text-red-700' },
      { key: 'faltaPintura', name: 'Falta Pintura', shortName: 'Falta Pint.', color: '#f97316', bgClass: 'bg-orange-50/50', textClass: 'text-orange-700' },
      { key: 'repise', name: 'Repise', shortName: 'Repise', color: '#f59e0b', bgClass: 'bg-amber-50/50', textClass: 'text-amber-700' },
      { key: 'grasa', name: 'Grasa', shortName: 'Grasa', color: '#8b5cf6', bgClass: 'bg-purple-50/50', textClass: 'text-purple-700' },
      { key: 'penetracion', name: 'Penetración', shortName: 'Penetrac.', color: '#3b82f6', bgClass: 'bg-blue-50/50', textClass: 'text-blue-700' },
      { key: 'descases', name: 'Descases', shortName: 'Descases', color: '#06b6d4', bgClass: 'bg-cyan-50/50', textClass: 'text-cyan-700' },
      { key: 'quemadas', name: 'Quemadas', shortName: 'Quemadas', color: '#ec4899', bgClass: 'bg-pink-50/50', textClass: 'text-pink-700' },
      { key: 'logosCorridos', name: 'Logos Corridos', shortName: 'Logos', color: '#64748b', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
    ],
    tintoreria: [
      { key: 'manchaTintoreria', name: 'Mancha Tintorería', shortName: 'Mancha Tinta', color: '#06b6d4', bgClass: 'bg-cyan-50/50', textClass: 'text-cyan-700' },
      { key: 'manchaOxido', name: 'Mancha Óxido', shortName: 'Óxido', color: '#d97706', bgClass: 'bg-amber-50/50', textClass: 'text-amber-700' },
      { key: 'arrastreBarca', name: 'Arrastre Barca', shortName: 'Arrastre', color: '#6366f1', bgClass: 'bg-indigo-50/50', textClass: 'text-indigo-700' },
      { key: 'sucias', name: 'Sucias', shortName: 'Sucias', color: '#f43f5e', bgClass: 'bg-rose-50/50', textClass: 'text-rose-700' },
      { key: 'vetas', name: 'Vetas', shortName: 'Vetas', color: '#0d9488', bgClass: 'bg-teal-50/50', textClass: 'text-teal-700' },
      { key: 'medida', name: 'Medida', shortName: 'Medida', color: '#8b5cf6', bgClass: 'bg-violet-50/50', textClass: 'text-violet-700' },
      { key: 'rama', name: 'Rama', shortName: 'Rama', color: '#2563eb', bgClass: 'bg-blue-50/50', textClass: 'text-blue-700' },
      { key: 'grasaTintoreria', name: 'Grasa', shortName: 'Grasa', color: '#475569', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
    ],
    tejeduria: [
      { key: 'revienteTrama', name: 'Reviente Trama', shortName: 'Trama', color: '#10b981', bgClass: 'bg-emerald-50/50', textClass: 'text-emerald-700' },
      { key: 'revienteUrdimbre', name: 'Reviente Urdimbre', shortName: 'Urdimbre', color: '#0d9488', bgClass: 'bg-teal-50/50', textClass: 'text-teal-700' },
      { key: 'marra', name: 'Marra', shortName: 'Marra', color: '#f59e0b', bgClass: 'bg-amber-50/50', textClass: 'text-amber-700' },
      { key: 'rayas', name: 'Rayas', shortName: 'Rayas', color: '#f97316', bgClass: 'bg-orange-50/50', textClass: 'text-orange-700' },
      { key: 'variacionesRizo', name: 'Variaciones Rizo', shortName: 'Var. Rizo', color: '#8b5cf6', bgClass: 'bg-purple-50/50', textClass: 'text-purple-700' },
      { key: 'hiloContaminado', name: 'Hilo Contaminado', shortName: 'Hilo Contam.', color: '#ef4444', bgClass: 'bg-red-50/50', textClass: 'text-red-700' },
      { key: 'orillosLaterales', name: 'Orillos Laterales', shortName: 'Orillos', color: '#06b6d4', bgClass: 'bg-cyan-50/50', textClass: 'text-cyan-700' },
    ],
    costura: [
      { key: 'tundidoCaido', name: 'Tundido Caído', shortName: 'Tundido', color: '#a855f7', bgClass: 'bg-purple-50/50', textClass: 'text-purple-700' },
      { key: 'montadasCostura', name: 'Montadas Costura', shortName: 'Montadas', color: '#6366f1', bgClass: 'bg-indigo-50/50', textClass: 'text-indigo-700' },
      { key: 'manchasNegras', name: 'Manchas Negras', shortName: 'Manchas Negras', color: '#334155', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
      { key: 'enganches', name: 'Enganches', shortName: 'Enganches', color: '#f59e0b', bgClass: 'bg-amber-50/50', textClass: 'text-amber-700' },
    ],
    todos: [
      { key: 'totalEstampado', name: 'Estampado', shortName: 'Estampado', color: '#e11d48', bgClass: 'bg-rose-50/50', textClass: 'text-rose-700' },
      { key: 'totalTintoreria', name: 'Tintorería', shortName: 'Tintorería', color: '#0891b2', bgClass: 'bg-cyan-50/50', textClass: 'text-cyan-700' },
      { key: 'totalTejeduria', name: 'Tejeduría', shortName: 'Tejeduría', color: '#059669', bgClass: 'bg-emerald-50/50', textClass: 'text-emerald-700' },
      { key: 'totalCostura', name: 'Costura', shortName: 'Costura', color: '#7c3aed', bgClass: 'bg-purple-50/50', textClass: 'text-purple-700' },
    ],
  };

  // Totales acumulados por proceso en los registros visibles (para los badges de los botones)
  const globalProcessTotals = useMemo(() => {
    let est = 0;
    let tint = 0;
    let tej = 0;
    let cost = 0;
    visibleRecords.forEach(r => {
      est += r.defectosEstampado?.totalEstampado || 0;
      tint += r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0;
      tej += r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0;
      cost += r.defectosCostura?.totalCostura ?? r.totalCostura ?? 0;
    });
    return {
      estampado: est,
      tintoreria: tint,
      tejeduria: tej,
      costura: cost,
      total: est + tint + tej + cost,
    };
  }, [visibleRecords]);

  // ── DESGLOSE Y DIAGNÓSTICO DE FALLAS POR DISEÑO (REFERENCIA EN TALLER) ──
  const defectsByDesign = useMemo(() => {
    const map = new Map<string, {
      diseno: string;
      referencia: string;
      dimensiones: string;
      tecnica: 'REACTIVO' | 'PIGMENTO';
      totalRevisadas: number;
      totalBuenas: number;
      totalSegundas: number;
      // Estampado
      totalEstampado: number;
      manchas: number;
      faltaPintura: number;
      repise: number;
      grasa: number;
      penetracion: number;
      descases: number;
      quemadas: number;
      logosCorridos: number;
      // Tintorería
      totalTintoreria: number;
      manchaTintoreria: number;
      manchaOxido: number;
      arrastreBarca: number;
      sucias: number;
      vetas: number;
      medida: number;
      rama: number;
      grasaTintoreria: number;
      // Tejeduría
      totalTejeduria: number;
      revienteUrdimbre: number;
      revienteTrama: number;
      marra: number;
      rayas: number;
      variacionesRizo: number;
      hiloContaminado: number;
      orillosLaterales: number;
      // Costura
      totalCostura: number;
      tundidoCaido: number;
      montadasCostura: number;
      manchasNegras: number;
      enganches: number;
      // Otros
      pegas: number;
      arreLaterales: number;
      arreCabeceras: number;
      lotesCount: number;
    }>();

    visibleRecords.forEach(r => {
      const dis = (r.diseno || 'SIN DISEÑO').trim().toUpperCase();
      const existing = map.get(dis) || {
        diseno: dis,
        referencia: r.referencia || 'C280T',
        dimensiones: r.dimensiones || '',
        tecnica: (r.tecnica || inferTecnica(r.diseno, r.referencia)) as 'REACTIVO' | 'PIGMENTO',
        totalRevisadas: 0,
        totalBuenas: 0,
        totalSegundas: 0,
        // Estampado
        totalEstampado: 0,
        manchas: 0,
        faltaPintura: 0,
        repise: 0,
        grasa: 0,
        penetracion: 0,
        descases: 0,
        quemadas: 0,
        logosCorridos: 0,
        // Tintorería
        totalTintoreria: 0,
        manchaTintoreria: 0,
        manchaOxido: 0,
        arrastreBarca: 0,
        sucias: 0,
        vetas: 0,
        medida: 0,
        rama: 0,
        grasaTintoreria: 0,
        // Tejeduría
        totalTejeduria: 0,
        revienteUrdimbre: 0,
        revienteTrama: 0,
        marra: 0,
        rayas: 0,
        variacionesRizo: 0,
        hiloContaminado: 0,
        orillosLaterales: 0,
        // Costura
        totalCostura: 0,
        tundidoCaido: 0,
        montadasCostura: 0,
        manchasNegras: 0,
        enganches: 0,
        // Otros
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        lotesCount: 0,
      };

      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.totalBuenas += r.cantBuena || 0;
      existing.totalSegundas += r.totalSegundas || 0;

      // Estampado
      existing.totalEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.manchas += r.defectosEstampado?.manchas || 0;
      existing.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
      existing.repise += r.defectosEstampado?.repise || 0;
      existing.grasa += r.defectosEstampado?.grasa || 0;
      existing.penetracion += r.defectosEstampado?.penetracion || 0;
      existing.descases += r.defectosEstampado?.descases || 0;
      existing.quemadas += r.defectosEstampado?.quemadas || 0;
      existing.logosCorridos += r.defectosEstampado?.logosCorridos || 0;

      // Tintorería
      const tint = r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0;
      existing.totalTintoreria += tint;
      existing.manchaTintoreria += r.defectosTintoreria?.manchaTintoreria || 0;
      existing.manchaOxido += r.defectosTintoreria?.manchaOxido || 0;
      existing.arrastreBarca += r.defectosTintoreria?.arrastreBarca || 0;
      existing.sucias += r.defectosTintoreria?.sucias || 0;
      existing.vetas += r.defectosTintoreria?.vetas || 0;
      existing.medida += r.defectosTintoreria?.medida || 0;
      existing.rama += r.defectosTintoreria?.rama || 0;
      existing.grasaTintoreria += r.defectosTintoreria?.grasa || 0;

      // Tejeduría
      const tej = r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0;
      existing.totalTejeduria += tej;
      existing.revienteUrdimbre += r.defectosTejeduria?.revienteUrdimbre || 0;
      existing.revienteTrama += r.defectosTejeduria?.revienteTrama || 0;
      existing.marra += r.defectosTejeduria?.marra || 0;
      existing.rayas += r.defectosTejeduria?.rayas || 0;
      existing.variacionesRizo += r.defectosTejeduria?.variacionesRizo || 0;
      existing.hiloContaminado += r.defectosTejeduria?.hiloContaminado || 0;
      existing.orillosLaterales += r.defectosTejeduria?.orillosLaterales || 0;

      // Costura
      const cost = r.defectosCostura?.totalCostura ?? r.totalCostura ?? 0;
      existing.totalCostura += cost;
      existing.tundidoCaido += r.defectosCostura?.tundidoCaido || 0;
      existing.montadasCostura += r.defectosCostura?.montadasCostura || 0;
      existing.manchasNegras += r.defectosCostura?.manchasNegras || 0;
      existing.enganches += r.defectosCostura?.enganches || 0;

      existing.pegas += r.pegas || 0;
      existing.arreLaterales += r.arreLaterales || 0;
      existing.arreCabeceras += r.arreCabeceras || 0;
      existing.lotesCount += 1;

      map.set(dis, existing);
    });

    return Array.from(map.values()).map(item => {
      // Estampado
      const defsEst = [
        { key: 'manchas', name: 'Manchas', shortName: 'Manchas', cant: item.manchas, color: '#ef4444' },
        { key: 'faltaPintura', name: 'Falta Pintura', shortName: 'Falta Pint.', cant: item.faltaPintura, color: '#f97316' },
        { key: 'repise', name: 'Repise', shortName: 'Repise', cant: item.repise, color: '#f59e0b' },
        { key: 'grasa', name: 'Grasa', shortName: 'Grasa', cant: item.grasa, color: '#8b5cf6' },
        { key: 'penetracion', name: 'Penetración', shortName: 'Penetrac.', cant: item.penetracion, color: '#3b82f6' },
        { key: 'descases', name: 'Descases', shortName: 'Descases', cant: item.descases, color: '#06b6d4' },
        { key: 'quemadas', name: 'Quemadas', shortName: 'Quemadas', cant: item.quemadas, color: '#ec4899' },
        { key: 'logosCorridos', name: 'Logos Corridos', shortName: 'Logos', cant: item.logosCorridos, color: '#64748b' },
      ];

      // Tintorería
      const defsTint = [
        { key: 'manchaTintoreria', name: 'Mancha Tintorería', shortName: 'Mancha Tinta', cant: item.manchaTintoreria, color: '#06b6d4' },
        { key: 'manchaOxido', name: 'Mancha Óxido', shortName: 'Óxido', cant: item.manchaOxido, color: '#d97706' },
        { key: 'arrastreBarca', name: 'Arrastre Barca', shortName: 'Arrastre', cant: item.arrastreBarca, color: '#6366f1' },
        { key: 'sucias', name: 'Sucias', shortName: 'Sucias', cant: item.sucias, color: '#f43f5e' },
        { key: 'vetas', name: 'Vetas', shortName: 'Vetas', cant: item.vetas, color: '#0d9488' },
        { key: 'medida', name: 'Medida', shortName: 'Medida', cant: item.medida, color: '#8b5cf6' },
        { key: 'rama', name: 'Rama', shortName: 'Rama', cant: item.rama, color: '#2563eb' },
        { key: 'grasaTintoreria', name: 'Grasa', shortName: 'Grasa', cant: item.grasaTintoreria, color: '#475569' },
      ];

      // Tejeduría
      const defsTej = [
        { key: 'revienteTrama', name: 'Reviente Trama', shortName: 'Trama', cant: item.revienteTrama, color: '#10b981' },
        { key: 'revienteUrdimbre', name: 'Reviente Urdimbre', shortName: 'Urdimbre', cant: item.revienteUrdimbre, color: '#0d9488' },
        { key: 'marra', name: 'Marra', shortName: 'Marra', cant: item.marra, color: '#f59e0b' },
        { key: 'rayas', name: 'Rayas', shortName: 'Rayas', cant: item.rayas, color: '#f97316' },
        { key: 'variacionesRizo', name: 'Variaciones Rizo', shortName: 'Var. Rizo', cant: item.variacionesRizo, color: '#8b5cf6' },
        { key: 'hiloContaminado', name: 'Hilo Contaminado', shortName: 'Hilo Contam.', cant: item.hiloContaminado, color: '#ef4444' },
        { key: 'orillosLaterales', name: 'Orillos Laterales', shortName: 'Orillos', cant: item.orillosLaterales, color: '#06b6d4' },
      ];

      // Costura
      const defsCost = [
        { key: 'tundidoCaido', name: 'Tundido Caído', shortName: 'Tundido', cant: item.tundidoCaido, color: '#a855f7' },
        { key: 'montadasCostura', name: 'Montadas Costura', shortName: 'Montadas', cant: item.montadasCostura, color: '#6366f1' },
        { key: 'manchasNegras', name: 'Manchas Negras', shortName: 'Manchas Negras', cant: item.manchasNegras, color: '#334155' },
        { key: 'enganches', name: 'Enganches', shortName: 'Enganches', cant: item.enganches, color: '#f59e0b' },
      ];

      // Consolidado Multiproceso
      const totalMultiproceso = item.totalEstampado + item.totalTintoreria + item.totalTejeduria + item.totalCostura;
      const defsTodos = [
        { key: 'totalEstampado', name: 'Estampado', shortName: 'Estampado', cant: item.totalEstampado, color: '#e11d48' },
        { key: 'totalTintoreria', name: 'Tintorería', shortName: 'Tintorería', cant: item.totalTintoreria, color: '#0891b2' },
        { key: 'totalTejeduria', name: 'Tejeduría', shortName: 'Tejeduría', cant: item.totalTejeduria, color: '#059669' },
        { key: 'totalCostura', name: 'Costura', shortName: 'Costura', cant: item.totalCostura, color: '#7c3aed' },
      ];

      const getTopInfo = (list: typeof defsEst, totalFallas: number, fallbackName: string) => {
        const sorted = [...list].filter(x => x.cant > 0).sort((a, b) => b.cant - a.cant);
        if (sorted.length > 0) {
          const top = sorted[0];
          const pct = totalFallas > 0 ? Number(((top.cant / totalFallas) * 100).toFixed(1)) : 0;
          return { name: top.name, cant: top.cant, pct, color: top.color };
        }
        return { name: fallbackName, cant: 0, pct: 0, color: '#10b981' };
      };

      const topEst = getTopInfo(defsEst, item.totalEstampado, 'Sin defectos de estampado');
      const topTint = getTopInfo(defsTint, item.totalTintoreria, 'Sin defectos de tintorería');
      const topTej = getTopInfo(defsTej, item.totalTejeduria, 'Sin defectos de tejeduría');
      const topCost = getTopInfo(defsCost, item.totalCostura, 'Sin defectos de costura');
      const topTodos = getTopInfo(defsTodos, totalMultiproceso, '100% Conforme');

      // Proceso activo según fallasProcess
      let activeTotal = item.totalEstampado;
      let activeDefs = defsEst;
      let activeTop = topEst;
      if (fallasProcess === 'tintoreria') {
        activeTotal = item.totalTintoreria;
        activeDefs = defsTint;
        activeTop = topTint;
      } else if (fallasProcess === 'tejeduria') {
        activeTotal = item.totalTejeduria;
        activeDefs = defsTej;
        activeTop = topTej;
      } else if (fallasProcess === 'costura') {
        activeTotal = item.totalCostura;
        activeDefs = defsCost;
        activeTop = topCost;
      } else if (fallasProcess === 'todos') {
        activeTotal = totalMultiproceso;
        activeDefs = defsTodos;
        activeTop = topTodos;
      }

      const pctEst = item.totalRevisadas > 0 ? (item.totalEstampado / item.totalRevisadas) * 100 : 0;
      const pctBue = item.totalRevisadas > 0 ? (item.totalBuenas / item.totalRevisadas) * 100 : 0;
      const activePct = item.totalRevisadas > 0 ? (activeTotal / item.totalRevisadas) * 100 : 0;

      return {
        ...item,
        // Compatibilidad con allTopDesigns y vistas existentes
        topDefectoEstampado: topEst.name,
        topDefectoEstampadoCant: topEst.cant,
        topDefectoPct: topEst.pct,
        defectos: defsEst.filter(d => d.cant > 0).sort((a, b) => b.cant - a.cant),
        pctEstampado: Number(pctEst.toFixed(2)),
        pctBuenas: Number(pctBue.toFixed(1)),

        // Propiedades multiproceso dinámicas
        activeTotal,
        activePct: Number(activePct.toFixed(2)),
        activeDefs,
        activeTopName: activeTop.name,
        activeTopCant: activeTop.cant,
        activeTopPct: activeTop.pct,
        activeTopColor: activeTop.color,
        defsEst,
        defsTint,
        defsTej,
        defsCost,
        defsTodos,
      };
    });
  }, [visibleRecords, fallasProcess]);

  // Filtrado y ordenación de Diseños para la vista de Fallas
  const filteredDefectsByDesign = useMemo(() => {
    return defectsByDesign
      .filter(d => {
        if (!fallasDesignSearch) return true;
        const q = fallasDesignSearch.toLowerCase();
        return d.diseno.toLowerCase().includes(q) || d.referencia.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (fallasSortBy === 'fallas') return b.activeTotal - a.activeTotal;
        if (fallasSortBy === 'revisadas') return b.totalRevisadas - a.totalRevisadas;
        if (fallasSortBy === 'pct') return b.activePct - a.activePct;
        if (fallasSortBy === 'nombre') return a.diseno.localeCompare(b.diseno);
        return b.activeTotal - a.activeTotal;
      });
  }, [defectsByDesign, fallasDesignSearch, fallasSortBy]);

  // Datos para el gráfico comparativo de fallas por diseño según el proceso activo
  const fallasPorDisenoChartData = useMemo(() => {
    const specs = PROCESS_DEFECT_SPECS[fallasProcess];
    return filteredDefectsByDesign
      .filter(d => d.activeTotal > 0)
      .slice(0, 12)
      .map(d => {
        const entry: any = {
          diseno: d.diseno,
          tecnica: d.tecnica,
          referencia: d.referencia,
          totalFallas: d.activeTotal,
        };
        specs.forEach(s => {
          entry[s.name] = (d as any)[s.key] || 0;
        });
        return entry;
      });
  }, [filteredDefectsByDesign, fallasProcess]);

  // Opciones de Métrica para el Top Diseños de Calidad
  const TOP_DESIGN_METRICS = [
    { id: 'segundas' as const, label: 'Segundas Totales', unit: 'pz' },
    { id: 'estampado' as const, label: 'Fallas Estampación', unit: 'pz' },
    { id: 'revisadas' as const, label: 'Total Revisadas', unit: 'pz' },
    { id: 'pctSegundas' as const, label: '% de Segundas', unit: '%' },
  ];

  // ── TOP DISEÑOS DINÁMICO PARA EL DASHBOARD COMPARATIVO ──
  const allTopDesigns = useMemo(() => {
    const map = new Map<string, {
      name: string;
      process: 'REACTIVO' | 'PIGMENTO';
      referencia: string;
      totalSegundas: number;
      defectosEstampado: number;
      totalRevisadas: number;
      buenas: number;
      pctSegundas: number;
      topDefecto: string;
      topDefectoCant: number;
      count: number;
    }>();

    timeFilteredRecords.forEach(r => {
      const name = (r.diseno || 'SIN DISEÑO').trim().toUpperCase();
      const existing = map.get(name) || {
        name,
        process: (r.tecnica || inferTecnica(r.diseno, r.referencia)) as 'REACTIVO' | 'PIGMENTO',
        referencia: r.referencia || '',
        totalSegundas: 0,
        defectosEstampado: 0,
        totalRevisadas: 0,
        buenas: 0,
        pctSegundas: 0,
        topDefecto: '',
        topDefectoCant: 0,
        count: 0
      };

      const seg = r.totalSegundas !== undefined ? r.totalSegundas : (r.defectosEstampado?.totalEstampado || 0);
      existing.totalSegundas += seg;
      existing.defectosEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.buenas += r.cantBuena || 0;
      existing.count += 1;

      map.set(name, existing);
    });

    return Array.from(map.values()).map(d => {
      const designInfo = defectsByDesign.find(x => x.diseno === d.name);
      const pct = d.totalRevisadas > 0 ? (d.totalSegundas / d.totalRevisadas) * 100 : 0;
      return {
        ...d,
        pctSegundas: Number(pct.toFixed(1)),
        topDefecto: designInfo?.topDefectoEstampado || 'Sin fallas',
        topDefectoCant: designInfo?.topDefectoEstampadoCant || 0
      };
    });
  }, [timeFilteredRecords, defectsByDesign]);

  const activeTopDesignsList = useMemo(() => {
    let list = allTopDesigns.map(d => {
      let value = 0;
      if (topDesignMetric === 'segundas') value = d.totalSegundas;
      else if (topDesignMetric === 'estampado') value = d.defectosEstampado;
      else if (topDesignMetric === 'revisadas') value = d.totalRevisadas;
      else if (topDesignMetric === 'pctSegundas') value = d.pctSegundas;

      return {
        ...d,
        value
      };
    });

    // Filtro de diseños ocultos
    list = list.filter(d => !hiddenTopDesigns.includes(d.name));

    // Filtro de proceso (REACTIVO / PIGMENTO)
    if (topDesignProcessFilter !== 'all') {
      list = list.filter(d => d.process === topDesignProcessFilter);
    }

    // Filtro por Mayor impacto de error / Nivel de Riesgo
    if (topDesignRiskFilter === 'critical') {
      list = list.filter(d => d.pctSegundas >= 8.0);
    } else if (topDesignRiskFilter === 'warning') {
      list = list.filter(d => d.pctSegundas >= 4.0 && d.pctSegundas < 8.0);
    } else if (topDesignRiskFilter === 'normal') {
      list = list.filter(d => d.pctSegundas < 4.0);
    }

    // Filtro por Líneas de Producto / Base de Tela
    if (topDesignFabricFilter !== 'all') {
      list = list.filter(d => (d.referencia || '').trim().toUpperCase() === topDesignFabricFilter.toUpperCase());
    }

    // Búsqueda
    if (topDesignSearch.trim()) {
      const q = topDesignSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    // Orden (Desc / Asc)
    if (topDesignSortOrder === 'asc') {
      list = [...list].sort((a, b) => a.value - b.value);
    } else {
      list = [...list].sort((a, b) => b.value - a.value);
    }

    // Límite (Top 5, Top 10, Top 20, Todos)
    if (topDesignLimit > 0) {
      list = list.slice(0, topDesignLimit);
    }

    return list;
  }, [allTopDesigns, hiddenTopDesigns, topDesignMetric, topDesignProcessFilter, topDesignRiskFilter, topDesignFabricFilter, topDesignSearch, topDesignSortOrder, topDesignLimit]);

  // Sugerencias para el buscador predictivo de diseños
  const predictiveSuggestions = useMemo(() => {
    if (!topDesignSearch.trim()) return [];
    const q = topDesignSearch.trim().toLowerCase();
    return allTopDesigns
      .filter(d => d.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allTopDesigns, topDesignSearch]);

  const totalMetricSum = useMemo(() => {
    return allTopDesigns.reduce((acc, d) => {
      if (topDesignMetric === 'segundas') return acc + d.totalSegundas;
      if (topDesignMetric === 'estampado') return acc + d.defectosEstampado;
      if (topDesignMetric === 'revisadas') return acc + d.totalRevisadas;
      return acc + d.pctSegundas;
    }, 0);
  }, [allTopDesigns, topDesignMetric]);

  const modalDesignsList = useMemo(() => {
    let list = allTopDesigns;
    if (modalProcessFilter !== 'all') {
      list = list.filter(d => d.process === modalProcessFilter);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [allTopDesigns, modalProcessFilter, modalSearch]);

  const toggleHideDesign = (name: string) => {
    setHiddenTopDesigns(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const showAllDesigns = () => {
    setHiddenTopDesigns([]);
  };

  const hideAllDesigns = () => {
    setHiddenTopDesigns(allTopDesigns.map(d => d.name));
  };

  const invertHiddenDesigns = () => {
    setHiddenTopDesigns(prev =>
      allTopDesigns.map(d => d.name).filter(name => !prev.includes(name))
    );
  };

  // Gráfica Comparativa Primeras vs Segundas
  const comparativaData = useMemo(() => {
    if (comparativaGrouping === 'dia') {
      const dayMap = new Map<string, {
        label: string;
        estampadas: number;
        segundas: number;
        primeras: number;
        pctPrimeras: number;
      }>();

      visibleRecords.forEach(r => {
        const dateKey = r.fecha || 'Sin fecha';
        const [, m, d] = dateKey.split('-');
        const shortLabel = d && m ? `${parseInt(d, 10)}-${MONTH_NAMES[parseInt(m, 10) - 1]?.slice(0, 3)}` : dateKey;

        const est = r.cantTotalRevisada || 0;
        const seg = r.totalSegundas !== undefined ? r.totalSegundas : (r.defectosEstampado?.totalEstampado || 0);
        const prim = r.cantBuena || 0;

        const current = dayMap.get(dateKey) || {
          label: shortLabel,
          estampadas: 0,
          segundas: 0,
          primeras: 0,
          pctPrimeras: 0
        };

        current.estampadas += est;
        current.segundas += seg;
        current.primeras += prim;
        dayMap.set(dateKey, current);
      });

      return Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, val]) => ({
          ...val,
          pctPrimeras: val.estampadas > 0 ? Number(((val.primeras / val.estampadas) * 100).toFixed(1)) : 0
        }));
    } else {
      const desMap = new Map<string, {
        label: string;
        estampadas: number;
        segundas: number;
        primeras: number;
        pctPrimeras: number;
        tecnica: string;
      }>();

      visibleRecords.forEach(r => {
        const name = (r.diseno || 'SIN DISEÑO').trim();
        const est = r.cantTotalRevisada || 0;
        const seg = r.totalSegundas !== undefined ? r.totalSegundas : (r.defectosEstampado?.totalEstampado || 0);
        const prim = r.cantBuena || 0;
        const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);

        const current = desMap.get(name) || {
          label: name,
          estampadas: 0,
          segundas: 0,
          primeras: 0,
          pctPrimeras: 0,
          tecnica: tec
        };

        current.estampadas += est;
        current.segundas += seg;
        current.primeras += prim;
        desMap.set(name, current);
      });

      return Array.from(desMap.values())
        .sort((a, b) => b.estampadas - a.estampadas)
        .slice(0, 10)
        .map(val => ({
          ...val,
          pctPrimeras: val.estampadas > 0 ? Number(((val.primeras / val.estampadas) * 100).toFixed(1)) : 0
        }));
    }
  }, [visibleRecords, comparativaGrouping]);

  // ── MAPA MENSUAL DE TODO EL HISTÓRICO (Filtrado por técnica, referencia y diseño) ──
  // Permite siempre tener el mes previo para deltas aun cuando se filtre un solo mes
  const allHistoricalMonthsData = useMemo(() => {
    const map = new Map<string, {
      key: string;
      year: number;
      month: number;
      monthName: string;
      label: string;
      revisadas: number;
      buenas: number;
      segundas: number;
      arreCabeceras: number;
      arreLaterales: number;
      pegas: number;
      estampado: number;
      tintoreria: number;
      tejeduria: number;
    }>();

    records.forEach(r => {
      // Filtro de técnica
      const tecnica = r.tecnica || inferTecnica(r.diseno, r.referencia);
      if (tecnicaFilter !== 'all' && tecnica !== tecnicaFilter) return;

      // Filtro de referencia (tela base: C280T, ME1002, ML1002)
      if (referenciaFilter !== 'all' && (r.referencia || '').trim().toUpperCase() !== referenciaFilter.toUpperCase()) return;

      // Filtro de diseño (referencia de taller)
      if (disenoFilter !== 'all' && (r.diseno || '').trim().toUpperCase() !== disenoFilter.toUpperCase()) return;

      if (!r.fecha) return;
      const normalized = normalizeExcelDate(r.fecha);
      const parts = normalized.split('-');
      if (parts.length < 2) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return;

      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const existing = map.get(key) || {
        key,
        year: y,
        month: m,
        monthName: MONTH_NAMES[m],
        label: `${MONTH_NAMES[m]} ${y}`,
        revisadas: 0,
        buenas: 0,
        segundas: 0,
        arreCabeceras: 0,
        arreLaterales: 0,
        pegas: 0,
        estampado: 0,
        tintoreria: 0,
        tejeduria: 0
      };

      const rev = Number(r.cantTotalRevisada) || 0;
      const bna = Number(r.cantBuena) || 0;
      const seg = Number(r.totalSegundas) || 0;
      const cab = Number(r.arreCabeceras) || 0;
      const lat = Number(r.arreLaterales) || 0;
      const peg = Number(r.pegas) || 0;
      const est = Number(r.defectosEstampado?.totalEstampado) || 0;
      const tint = Number(r.defectosTintoreria?.totalTintoreria) || Number(r.totalTintoreria) || 0;
      const mn = Number(r.defectosCostura?.manchasNegras) || 0;
      const tej = Number(r.defectosTejeduria?.totalTejeduria) || Number(r.totalTejeduria) || 0;

      existing.revisadas += rev;
      existing.buenas += bna;
      existing.segundas += seg;
      existing.arreCabeceras += cab;
      existing.arreLaterales += lat;
      existing.pegas += peg;
      existing.estampado += est;
      // En la fórmula oficial del taller (celda J3 Excel Base Procesos), Tintorería suma tintorería + manchas negras
      existing.tintoreria += (tint + mn);
      existing.tejeduria += tej;

      map.set(key, existing);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, data]) => {
        const rev = data.revisadas || 1;
        const pctEstampado = Number(((data.estampado / rev) * 100).toFixed(1));
        const pctTintoreria = Number(((data.tintoreria / rev) * 100).toFixed(1));
        const pctTejeduria = Number(((data.tejeduria / rev) * 100).toFixed(1));
        const pctBuenas = Number(((data.buenas / rev) * 100).toFixed(1));
        const pctSegundas = Number(((data.segundas / rev) * 100).toFixed(2));
        const arreglosTotales = data.arreCabeceras + data.arreLaterales;
        const pctArreglos = Number(((arreglosTotales / rev) * 100).toFixed(2));
        const pctPegas = Number(((data.pegas / rev) * 100).toFixed(2));

        return {
          ...data,
          arreglosTotales,
          pctEstampado,
          pctTintoreria,
          pctTejeduria,
          pctBuenas,
          pctSegundas,
          pctArreglos,
          pctPegas
        };
      });
  }, [records, tecnicaFilter, referenciaFilter, disenoFilter]);

  // ── DATOS PARA LA GRÁFICA "COMPARACIÓN MENSUAL PONDERADA" ──
  // Si monthlyComparisonScope === 'filtered': se limita exactamente al periodo que el usuario tiene activo (Mes, Año, Rango, o Todo)
  // Si monthlyComparisonScope === 'all': muestra todos los meses disponibles para comparar
  const monthlyProcessComparisonData = useMemo(() => {
    if (monthlyComparisonScope === 'all') {
      return allHistoricalMonthsData;
    }

    // Filtrado estricto por el periodo activo
    if (timeFilter === 'month') {
      return allHistoricalMonthsData.filter(
        d => d.year === selectedYear && d.month === selectedMonth
      );
    }
    if (timeFilter === 'year') {
      return allHistoricalMonthsData.filter(d => d.year === selectedYear);
    }
    if (timeFilter === 'range') {
      return allHistoricalMonthsData.filter(d => {
        if (!startDate && !endDate) return true;
        const monthStart = `${d.year}-${String(d.month + 1).padStart(2, '0')}-01`;
        const nextMonth = d.month === 11 ? `${d.year + 1}-01-01` : `${d.year}-${String(d.month + 2).padStart(2, '0')}-01`;
        if (endDate && monthStart > endDate) return false;
        if (startDate && nextMonth <= startDate) return false;
        return true;
      });
    }

    return allHistoricalMonthsData;
  }, [allHistoricalMonthsData, monthlyComparisonScope, timeFilter, selectedMonth, selectedYear, startDate, endDate]);

  // ── ESTADÍSTICAS Y DELTAS VS MES ANTERIOR ──
  const monthOverMonthStats = useMemo(() => {
    if (allHistoricalMonthsData.length === 0) return null;

    let targetIdx = -1;
    if (timeFilter === 'month') {
      targetIdx = allHistoricalMonthsData.findIndex(
        m => m.year === selectedYear && m.month === selectedMonth
      );
    } else {
      targetIdx = allHistoricalMonthsData.length - 1;
    }

    if (targetIdx === -1) {
      return {
        notFound: true,
        selectedMonthName: MONTH_NAMES[selectedMonth],
        selectedYear,
        hasPrev: false,
        current: null,
        prev: null,
        deltaEst: 0,
        deltaTint: 0,
        deltaTej: 0,
        deltaVolumen: 0,
        deltaVolumenPct: 0,
        deltaBuenas: 0,
        deltaSegundas: 0,
        deltaArreglos: 0,
        deltaPegas: 0
      };
    }

    const current = allHistoricalMonthsData[targetIdx];
    const prev = targetIdx > 0 ? allHistoricalMonthsData[targetIdx - 1] : null;

    if (!prev) {
      return {
        notFound: false,
        hasPrev: false,
        current,
        prev: null,
        deltaEst: 0,
        deltaTint: 0,
        deltaTej: 0,
        deltaVolumen: 0,
        deltaVolumenPct: 0,
        deltaBuenas: 0,
        deltaSegundas: 0,
        deltaArreglos: 0,
        deltaPegas: 0
      };
    }

    const deltaEst = Number((current.pctEstampado - prev.pctEstampado).toFixed(1));
    const deltaTint = Number((current.pctTintoreria - prev.pctTintoreria).toFixed(1));
    const deltaTej = Number((current.pctTejeduria - prev.pctTejeduria).toFixed(1));

    const deltaVolumen = current.revisadas - prev.revisadas;
    const deltaVolumenPct = prev.revisadas > 0 ? Number(((deltaVolumen / prev.revisadas) * 100).toFixed(1)) : 0;
    const deltaBuenas = Number((current.pctBuenas - prev.pctBuenas).toFixed(1));
    const deltaSegundas = Number((current.pctSegundas - prev.pctSegundas).toFixed(2));
    const deltaArreglos = Number((current.pctArreglos - prev.pctArreglos).toFixed(2));
    const deltaPegas = Number((current.pctPegas - prev.pctPegas).toFixed(2));

    return {
      notFound: false,
      hasPrev: true,
      current,
      prev,
      deltaEst,
      deltaTint,
      deltaTej,
      deltaVolumen,
      deltaVolumenPct,
      deltaBuenas,
      deltaSegundas,
      deltaArreglos,
      deltaPegas
    };
  }, [allHistoricalMonthsData, selectedMonth, selectedYear, timeFilter]);

  // ── TASAS CLAVE COMPARATIVAS MES ACTUAL VS MES ANTERIOR ──
  const comparativeRatesMoM = useMemo(() => {
    if (!monthOverMonthStats || !monthOverMonthStats.current) return [];
    const { current, prev, hasPrev } = monthOverMonthStats;
    const prevMonthName = prev ? prev.monthName : 'Línea Base';

    return [
      {
        indicador: '1ª Calidad',
        [prevMonthName]: prev ? prev.pctBuenas : 0,
        [current.monthName]: current.pctBuenas,
        prevVal: prev ? prev.pctBuenas : 0,
        currentVal: current.pctBuenas,
        delta: hasPrev && prev ? Number((current.pctBuenas - prev.pctBuenas).toFixed(1)) : 0,
        isFavorable: hasPrev && prev ? (current.pctBuenas - prev.pctBuenas) >= 0 : true,
        prevColor: '#a7f3d0',
        currColor: '#10b981',
        category: 'calidad'
      },
      {
        indicador: 'Segundas',
        [prevMonthName]: prev ? prev.pctSegundas : 0,
        [current.monthName]: current.pctSegundas,
        prevVal: prev ? prev.pctSegundas : 0,
        currentVal: current.pctSegundas,
        delta: hasPrev && prev ? Number((current.pctSegundas - prev.pctSegundas).toFixed(2)) : 0,
        isFavorable: hasPrev && prev ? (current.pctSegundas - prev.pctSegundas) <= 0 : true,
        prevColor: '#fde68a',
        currColor: '#f59e0b',
        category: 'segundas'
      },
      {
        indicador: 'Arreglos',
        [prevMonthName]: prev ? prev.pctArreglos : 0,
        [current.monthName]: current.pctArreglos,
        prevVal: prev ? prev.pctArreglos : 0,
        currentVal: current.pctArreglos,
        delta: hasPrev && prev ? Number((current.pctArreglos - prev.pctArreglos).toFixed(2)) : 0,
        isFavorable: hasPrev && prev ? (current.pctArreglos - prev.pctArreglos) <= 0 : true,
        prevColor: '#bae6fd',
        currColor: '#0284c7',
        category: 'arreglos'
      },
      {
        indicador: 'Pegas',
        [prevMonthName]: prev ? prev.pctPegas : 0,
        [current.monthName]: current.pctPegas,
        prevVal: prev ? prev.pctPegas : 0,
        currentVal: current.pctPegas,
        delta: hasPrev && prev ? Number((current.pctPegas - prev.pctPegas).toFixed(2)) : 0,
        isFavorable: hasPrev && prev ? (current.pctPegas - prev.pctPegas) <= 0 : true,
        prevColor: '#c7d2fe',
        currColor: '#6366f1',
        category: 'pegas'
      }
    ];
  }, [monthOverMonthStats]);

  // Pareto global
  const paretoDefectosData = useMemo(() => {
    const rawDefects = [
      { name: 'Manchas', count: totals.manchas, color: DEFECT_COLORS[0] },
      { name: 'Falta Pintura', count: totals.faltaPintura, color: DEFECT_COLORS[1] },
      { name: 'Repise', count: totals.repise, color: DEFECT_COLORS[2] },
      { name: 'Grasa', count: totals.grasa, color: DEFECT_COLORS[3] },
      { name: 'Penetración', count: totals.penetracion, color: DEFECT_COLORS[4] },
      { name: 'Descases', count: totals.descases, color: DEFECT_COLORS[5] },
      { name: 'Quemadas', count: totals.quemadas, color: DEFECT_COLORS[6] },
      { name: 'Logos Corridos', count: totals.logosCorridos, color: DEFECT_COLORS[7] },
    ].sort((a, b) => b.count - a.count);

    let cumulative = 0;
    const totalEst = totals.estampado || 1;
    return rawDefects.map(d => {
      cumulative += d.count;
      return {
        ...d,
        pct: (d.count / totalEst) * 100,
        cumulativePct: Number(((cumulative / totalEst) * 100).toFixed(1))
      };
    });
  }, [totals]);

  // Filtrado y Ordenación de la Planilla
  const filteredRecords = useMemo(() => {
    return visibleRecords
      .filter(r => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          (r.diseno || '').toLowerCase().includes(query) ||
          (r.referencia || '').toLowerCase().includes(query) ||
          (r.revisadoras || '').toLowerCase().includes(query) ||
          (r.tecnica || '').toLowerCase().includes(query) ||
          (r.observaciones || '').toLowerCase().includes(query);

        if (!matchesSearch) return false;

        if (filterSeverity === 'optimo') return (r.pctEstampado || 0) < 0.015;
        if (filterSeverity === 'alerta') return (r.pctEstampado || 0) >= 0.015 && (r.pctEstampado || 0) <= 0.03;
        if (filterSeverity === 'critico') return (r.pctEstampado || 0) > 0.03;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'fecha') diff = (a.fecha || '').localeCompare(b.fecha || '');
        else if (sortBy === 'revisadas') diff = (a.cantTotalRevisada || 0) - (b.cantTotalRevisada || 0);
        else if (sortBy === 'pctEstampado') diff = (a.pctEstampado || 0) - (b.pctEstampado || 0);
        else if (sortBy === 'tintoreria') diff = (a.defectosTintoreria?.totalTintoreria ?? a.totalTintoreria ?? 0) - (b.defectosTintoreria?.totalTintoreria ?? b.totalTintoreria ?? 0);
        else if (sortBy === 'tejeduria') diff = (a.defectosTejeduria?.totalTejeduria ?? a.totalTejeduria ?? 0) - (b.defectosTejeduria?.totalTejeduria ?? b.totalTejeduria ?? 0);
        else if (sortBy === 'totalSegundas') diff = (a.totalSegundas || 0) - (b.totalSegundas || 0);

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [visibleRecords, searchTerm, filterSeverity, sortBy, sortOrder]);

  // Modal Handlers
  const handleOpenNewModal = () => {
    setEditingRecord(null);
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormRevisadoras('BLANCA-MAYULIS-HEIDY-TATIANA');
    setFormReferencia('C280T');
    setFormDimensiones('60*120-280');
    setFormDiseno('');
    setFormColor('EST');
    setFormTecnica('REACTIVO');
    setFormTotalRevisada(2000);
    setFormCantBuena(1600);
    setFormPegas(80);
    setFormArrLat(150);
    setFormArrCab(130);
    setFormManchas(20);
    setFormRepise(5);
    setFormFaltaPintura(10);
    setFormLogosCorridos(0);
    setFormPenetracion(2);
    setFormGrasa(3);
    setFormDescases(0);
    setFormQuemadas(0);
    setFormObservaciones('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: SegundasRecord) => {
    setEditingRecord(rec);
    setFormFecha(rec.fecha || new Date().toISOString().slice(0, 10));
    setFormRevisadoras(rec.revisadoras || '');
    setFormReferencia(rec.referencia || '');
    setFormDimensiones(rec.dimensiones || '');
    setFormDiseno(rec.diseno || '');
    setFormColor(rec.color || 'EST');
    setFormTecnica(rec.tecnica || inferTecnica(rec.diseno, rec.referencia));
    setFormTotalRevisada(rec.cantTotalRevisada || 0);
    setFormCantBuena(rec.cantBuena || 0);
    setFormPegas(rec.pegas || 0);
    setFormArrLat(rec.arreLaterales || 0);
    setFormArrCab(rec.arreCabeceras || 0);
    setFormManchas(rec.defectosEstampado?.manchas || 0);
    setFormRepise(rec.defectosEstampado?.repise || 0);
    setFormFaltaPintura(rec.defectosEstampado?.faltaPintura || 0);
    setFormLogosCorridos(rec.defectosEstampado?.logosCorridos || 0);
    setFormPenetracion(rec.defectosEstampado?.penetracion || 0);
    setFormGrasa(rec.defectosEstampado?.grasa || 0);
    setFormDescases(rec.defectosEstampado?.descases || 0);
    setFormQuemadas(rec.defectosEstampado?.quemadas || 0);
    setFormObservaciones(rec.observaciones || '');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const totalEstampado =
      formManchas + formRepise + formFaltaPintura + formLogosCorridos +
      formPenetracion + formGrasa + formDescases + formQuemadas;

    const arreglos = formArrLat + formArrCab;
    const otrosProcesos = Math.max(0, formTotalRevisada - (formCantBuena + formPegas + arreglos + totalEstampado));
    const totalSeg = totalEstampado + otrosProcesos;
    const totalRev = formTotalRevisada || 1;

    const recordData: SegundasRecord = {
      id: editingRecord ? editingRecord.id : `seg-${Date.now()}`,
      fecha: formFecha,
      revisadoras: formRevisadoras.trim(),
      referencia: formReferencia.trim(),
      dimensiones: formDimensiones.trim(),
      diseno: formDiseno.trim().toUpperCase(),
      color: formColor.trim(),
      tecnica: formTecnica,
      cantTotalRevisada: formTotalRevisada,
      cantBuena: formCantBuena,
      pegas: formPegas,
      arreLaterales: formArrLat,
      pctLaterales: formArrLat / totalRev,
      arreCabeceras: formArrCab,
      pctCabeceras: formArrCab / totalRev,
      observaciones: formObservaciones.trim(),
      defectosEstampado: {
        manchas: formManchas,
        repise: formRepise,
        faltaPintura: formFaltaPintura,
        logosCorridos: formLogosCorridos,
        penetracion: formPenetracion,
        grasa: formGrasa,
        descases: formDescases,
        quemadas: formQuemadas,
        totalEstampado
      },
      pctEstampado: totalEstampado / totalRev,
      totalSegundas: totalSeg,
      pctTotalSegundas: totalSeg / totalRev
    };

    if (editingRecord) {
      updateRecords(records.map(r => r.id === editingRecord.id ? recordData : r));
    } else {
      updateRecords([recordData, ...records]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Registro de Inspección',
      message: '¿Estás seguro de que deseas eliminar este registro de segundas? Esta acción actualizará los indicadores de calidad.',
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: () => {
        deleteSegundasRecordCloud(id);
        updateRecords(records.filter(r => r.id !== id));
        if (selectedDetailRecord?.id === id) setSelectedDetailRecord(null);
        showToast('info', 'Registro eliminado', 'La inspección fue retirada del historial.');
        setConfirmDialog(null);
      }
    });
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restablecer Datos Originales',
      message: '¿Deseas restablecer los registros originales de la planilla de segundas? Se perderán las modificaciones no exportadas.',
      confirmText: 'Restablecer',
      danger: true,
      onConfirm: async () => {
        const master = [...INITIAL_SEGUNDAS_RECORDS, ...SEPTIEMBRE_SEGUNDAS_RECORDS, ...OCTUBRE_SEGUNDAS_RECORDS];
        await resetSegundasRecordsCloud(master);
        updateRecords(master);
        showToast('info', 'Datos restablecidos', 'Se han restaurado los registros originales del taller.');
        setConfirmDialog(null);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const imported: SegundasRecord[] = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
          if (!raw || raw.length < 2) continue;

          const cols = detectSegundasExcelColumns(raw[0] || [], raw[1] || []);

          // Detección dinámica: si raw[1] ya tiene cantidades numéricas en col cantTotal o cantBuena, los datos inician en fila 2 (índice 1)
          const startRow = (Number(raw[1]?.[cols.cantTotal]) > 0 || Number(raw[1]?.[cols.cantBuena]) > 0) ? 1 : 2;

          for (let r = startRow; r < raw.length; r++) {
            const row = raw[r];
            if (!row) continue;
            // Omitir fila si en cualquiera de las primeras columnas dice 'TOTAL'
            const isTotalRow = row.slice(0, 8).some(cell => String(cell || '').trim().toUpperCase() === 'TOTAL');
            if (isTotalRow) continue;
            if (!row[cols.cantTotal] && !row[cols.cantBuena]) continue;

            const fechaStr = normalizeExcelDate(row[cols.fecha]);
            if (!fechaStr) continue;

            const totalRev = Number(row[cols.cantTotal]) || 0;
            const cantBuena = Number(row[cols.cantBuena]) || 0;
            const pegas = Number(row[cols.pegas]) || 0;
            const arreLat = Number(row[cols.arreLat]) || 0;
            const arreCab = Number(row[cols.arreCab]) || 0;

            // Defectos Estampado (8 tipos)
            const manchas = Number(row[cols.manchas]) || 0;
            const repise = Number(row[cols.repise]) || 0;
            const faltaPintura = Number(row[cols.faltaPintura]) || 0;
            const logosCorridos = Number(row[cols.logosCorridos]) || 0;
            const penetracion = Number(row[cols.penetracion]) || 0;
            const grasaEst = Number(row[cols.grasaEst]) || 0;
            const descases = Number(row[cols.descases]) || 0;
            const quemadas = Number(row[cols.quemadas]) || 0;
            const totalEstampado = manchas + repise + faltaPintura + logosCorridos + penetracion + grasaEst + descases + quemadas;

            // Defectos Tintorería (8 tipos)
            const manchaTint = Number(row[cols.manchaTint]) || 0;
            const manchaOxido = Number(row[cols.manchaOxido]) || 0;
            const arrastreBarca = Number(row[cols.arrastreBarca]) || 0;
            const sucias = Number(row[cols.sucias]) || 0;
            const vetas = Number(row[cols.vetas]) || 0;
            const medida = Number(row[cols.medida]) || 0;
            const rama = Number(row[cols.rama]) || 0;
            const grasaTint = Number(row[cols.grasaTint]) || 0;
            const totalTintoreria = manchaTint + manchaOxido + arrastreBarca + sucias + vetas + medida + rama + grasaTint;

            // Defectos Tejeduría (7 tipos)
            const revUrdimbre = Number(row[cols.revUrdimbre]) || 0;
            const revTrama = Number(row[cols.revTrama]) || 0;
            const marra = Number(row[cols.marra]) || 0;
            const rayas = Number(row[cols.rayas]) || 0;
            const variacionesRizo = Number(row[cols.variacionesRizo]) || 0;
            const hiloContaminado = Number(row[cols.hiloContaminado]) || 0;
            const orillosLaterales = Number(row[cols.orillosLaterales]) || 0;
            const totalTejeduria = revUrdimbre + revTrama + marra + rayas + variacionesRizo + hiloContaminado + orillosLaterales;

            // Defectos Costura / Confección (4 tipos)
            const enganches = Number(row[cols.enganches]) || 0;
            const manchasNegras = Number(row[cols.manchasNegras]) || 0;
            const tundidoCaido = Number(row[cols.tundidoCaido]) || 0;
            const montadasCostura = Number(row[cols.montadasCostura]) || 0;
            const totalCostura = enganches + manchasNegras + tundidoCaido + montadasCostura;

            // Telas Rotas
            const rotas = Number(row[cols.rotas]) || 0;

            // Total Segundas (Total Unds RZ / R2 o suma de todos los defectos)
            const colTotalSeg = Number(row[cols.totalSegundas]) || 0;
            const sumSeg = totalEstampado + totalTintoreria + totalTejeduria + totalCostura + rotas;
            const totalSegundas = colTotalSeg > 0 ? colTotalSeg : sumSeg;

            const diseno = String(row[cols.diseno] || '').trim();
            const referencia = String(row[cols.referencia] || '').trim();

            imported.push({
              id: `seg-imp-${r}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fecha: fechaStr,
              revisadoras: String(row[cols.revisadoras] || '').trim(),
              cliente: String(row[cols.cliente] || '').trim(),
              pedidoLinea: String(row[cols.pedidoLinea] || '').trim(),
              referencia,
              dimensiones: String(row[cols.dimensiones] || '').trim(),
              diseno,
              color: row[cols.color] ? String(row[cols.color]).trim() : 'EST',
              tecnica: inferTecnica(diseno, referencia),
              cantTotalRevisada: totalRev,
              cantBuena,
              pegas,
              arreLaterales: arreLat,
              pctLaterales: totalRev > 0 ? Number((arreLat / totalRev).toFixed(6)) : 0,
              arreCabeceras: arreCab,
              pctCabeceras: totalRev > 0 ? Number((arreCab / totalRev).toFixed(6)) : 0,
              observaciones: row[cols.observaciones] ? String(row[cols.observaciones]).trim() : '',
              defectosEstampado: {
                manchas,
                repise,
                faltaPintura,
                logosCorridos,
                penetracion,
                grasa: grasaEst,
                descases,
                quemadas,
                totalEstampado
              },
              defectosTintoreria: {
                manchaTintoreria: manchaTint,
                manchaOxido: manchaOxido,
                arrastreBarca: arrastreBarca,
                sucias,
                vetas,
                medida,
                rama,
                grasa: grasaTint,
                totalTintoreria
              },
              defectosTejeduria: {
                revienteUrdimbre: revUrdimbre,
                revienteTrama: revTrama,
                marra,
                rayas,
                variacionesRizo,
                hiloContaminado,
                orillosLaterales,
                totalTejeduria
              },
              defectosCostura: {
                enganches,
                manchasNegras,
                tundidoCaido,
                montadasCostura,
                totalCostura
              },
              rotas,
              totalTintoreria,
              totalTejeduria,
              totalCostura,
              pctEstampado: totalRev > 0 ? Number((totalEstampado / totalRev).toFixed(6)) : 0,
              totalSegundas,
              pctTotalSegundas: totalRev > 0 ? Number((totalSegundas / totalRev).toFixed(6)) : 0
            });
          }
        }

        if (imported.length === 0) {
          showToast('error', 'Archivo sin datos válidos', 'No se encontraron filas con información de inspección en el archivo.');
          return;
        }

        // Agrupar períodos / meses detectados en el archivo
        const monthsMap: Record<string, { label: string; count: number; month: number; year: number }> = {};
        imported.forEach(r => {
          const parts = r.fecha.split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
              const key = `${y}-${m}`;
              const label = `${MONTH_NAMES[m]} ${y}`;
              if (!monthsMap[key]) {
                monthsMap[key] = { label, count: 0, month: m, year: y };
              }
              monthsMap[key].count++;
            }
          }
        });
        const detectedMonths = Object.entries(monthsMap).map(([key, data]) => ({ key, ...data }));

        // Análisis de duplicados contra el historial actual
        const existingFingerprints = new Set(records.map(getRecordFingerprint));
        const newRecords = imported.filter(r => !existingFingerprints.has(getRecordFingerprint(r)));
        const duplicatesCount = imported.length - newRecords.length;

        // Checklist de columnas esperadas
        const colCheck = [
          { name: 'Fecha de Inspección', col: 'Col A (0)', status: 'ok' as const, note: 'Fechas válidas en formato ISO/Excel' },
          { name: 'Revisadoras / Auditor', col: 'Col B (1)', status: 'ok' as const, note: 'Auditores registrados en planilla' },
          { name: 'Referencia de Tela Base', col: 'Col E (4)', status: 'ok' as const, note: 'Bases C280T, ME1002, ML1002 identificadas' },
          { name: 'Diseño / Referencia Taller', col: 'Col G (6)', status: 'ok' as const, note: 'Diseños registrados y clasificados' },
          { name: 'Cantidad Total Revisada', col: 'Col I (8)', status: 'ok' as const, note: 'Cantidades numéricas válidas' },
          { name: '1ª Calidad (Buenas)', col: 'Col J (9)', status: 'ok' as const, note: 'Cantidades numéricas válidas' },
          { name: 'Pegas (Empalmes de rollo)', col: 'Col K (10)', status: 'ok' as const, note: 'Separadas de segundas' },
          { name: 'Arreglos Laterales (Orillos)', col: 'Col L (11)', status: 'ok' as const, note: 'Reproceso registrado' },
          { name: 'Arreglos Cabeceras (Dobladillo)', col: 'Col N (13)', status: 'ok' as const, note: 'Reproceso registrado' },
          { name: 'Defectos de Estampado (8 tipos)', col: 'Cols Q-X (16-23)', status: 'ok' as const, note: 'Manchas, repise, falta pintura, grasa, etc.' },
          { name: 'Defectos de Tintorería (8 tipos)', col: 'Cols Y-AF (24-31)', status: 'ok' as const, note: 'Manchas, óxido, arrastre barca, sucias, vetas, etc.' },
          { name: 'Defectos de Tejeduría (7 tipos)', col: 'Cols AG-AM (32-38)', status: 'ok' as const, note: 'Reviente urdimbre, trama, marras, rayas, rizo, etc.' },
          { name: 'Costura y Físicas (4 tipos)', col: 'Cols AN-AQ (39-42)', status: 'ok' as const, note: 'Tundido caído, montadas, manchas negras, enganches' },
          { name: 'Telas Rotas y Total Segundas', col: 'Cols AR-AS (43-44)', status: 'ok' as const, note: 'Rotas y Total Unds R2 / RZ verificado' }
        ];

        const auditInfo: ImportAuditStatus = {
          fileName: file.name,
          uploadDate: new Date().toISOString(),
          sheetName: wb.SheetNames[0] || 'Hoja1',
          totalRowsRead: imported.length,
          validRecordsCount: imported.length,
          newRecordsCount: newRecords.length,
          duplicatesCount,
          detectedMonths: detectedMonths.map(m => ({ label: m.label, count: m.count })),
          columnsDetected: colCheck,
          allColumnsValid: true,
          status: 'success'
        };
        setLastImportAudit(auditInfo);
        try {
          localStorage.setItem('contex_segundas_import_audit', JSON.stringify(auditInfo));
        } catch (e) {}

        // Abrir modal de confirmación inteligente
        setImportPending({
          fileName: file.name,
          importedRecords: imported,
          detectedMonths,
          newRecords,
          duplicatesCount
        });
      } catch (err) {
        console.error(err);
        showToast('error', 'Error al procesar archivo', 'Ocurrió un error al leer el archivo Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmAccumulate = () => {
    if (!importPending) return;
    const incomingByFp = new Map<string, SegundasRecord>();
    importPending.importedRecords.forEach(r => {
      incomingByFp.set(getRecordFingerprint(r), r);
    });

    let updatedCount = 0;
    const updatedExisting = records.map(r => {
      const fp = getRecordFingerprint(r);
      if (incomingByFp.has(fp)) {
        updatedCount++;
        const fresh = incomingByFp.get(fp)!;
        incomingByFp.delete(fp);
        return fresh;
      }
      return r;
    });

    const completelyNew = Array.from(incomingByFp.values());
    const merged = [...completelyNew, ...updatedExisting];
    updateRecords(merged);

    // Auto-navegar al mes predominante de los datos importados para visualización inmediata
    if (importPending.detectedMonths.length > 0) {
      const primary = importPending.detectedMonths.reduce((prev, curr) => curr.count > prev.count ? curr : prev);
      setSelectedMonth(primary.month);
      setSelectedYear(primary.year);
      setTimeFilter('month');
    }

    const periodStr = importPending.detectedMonths.map(m => m.label).join(', ');
    showToast(
      'success',
      '¡Historial Actualizado con Éxito!',
      `Se actualizaron ${updatedCount} registros existentes con sus datos completos y se agregaron ${completelyNew.length} nuevos (${periodStr}). El historial conserva ${merged.length} registros en total.`
    );
    setImportPending(null);
  };

  const handleConfirmReplace = () => {
    if (!importPending) return;
    updateRecords(importPending.importedRecords);

    if (importPending.detectedMonths.length > 0) {
      const primary = importPending.detectedMonths.reduce((prev, curr) => curr.count > prev.count ? curr : prev);
      setSelectedMonth(primary.month);
      setSelectedYear(primary.year);
      setTimeFilter('month');
    }

    const periodStr = importPending.detectedMonths.map(m => m.label).join(', ');
    showToast(
      'info',
      'Historial Reemplazado',
      `Se guardaron ${importPending.importedRecords.length} registros de ${periodStr} como base única del historial.`
    );
    setImportPending(null);
  };

  const handleExportExcel = () => {
    const rows = filteredRecords.map(r => ({
      'FECHA': r.fecha,
      'TÉCNICA': r.tecnica || inferTecnica(r.diseno, r.referencia),
      'DISEÑO': r.diseno,
      'REFERENCIA': r.referencia,
      'DIMENSIONES': r.dimensiones,
      'REVISADORAS': r.revisadoras,
      'CANT. REVISADAS (TOTAL)': r.cantTotalRevisada,
      'CANT. PRIMERAS (BUENAS)': r.cantBuena,
      '% PRIMERA CALIDAD': `${((r.cantBuena / (r.cantTotalRevisada || 1)) * 100).toFixed(2)}%`,
      'PEGAS': r.pegas,
      'ARRE. LATERALES': r.arreLaterales,
      'ARRE. CABECERAS': r.arreCabeceras,
      'DEFECTOS ESTAMPADO': r.defectosEstampado?.totalEstampado || 0,
      'FALLA PRINCIPAL': getTopDefect(r)?.name || 'Ninguna',
      'MANCHAS': r.defectosEstampado?.manchas || 0,
      'REPISE': r.defectosEstampado?.repise || 0,
      'FALTA PINTURA': r.defectosEstampado?.faltaPintura || 0,
      'GRASA': r.defectosEstampado?.grasa || 0,
      'PENETRACIÓN': r.defectosEstampado?.penetracion || 0,
      'DESCASES': r.defectosEstampado?.descases || 0,
      'QUEMADAS': r.defectosEstampado?.quemadas || 0,
      'LOGOS CORRIDOS': r.defectosEstampado?.logosCorridos || 0,
      '% DEFECTO ESTAMPADO': `${((r.pctEstampado || 0) * 100).toFixed(2)}%`,
      'DEFECTOS TINTORERÍA': r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0,
      '% DEFECTO TINTORERÍA': `${(((r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0) / (r.cantTotalRevisada || 1)) * 100).toFixed(2)}%`,
      'DEFECTOS TEJEDURÍA': r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0,
      '% DEFECTO TEJEDURÍA': `${(((r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0) / (r.cantTotalRevisada || 1)) * 100).toFixed(2)}%`,
      'SEGUNDAS OTROS PROCESOS': Math.max(0, (r.cantTotalRevisada || 0) - ((r.cantBuena || 0) + (r.pegas || 0) + (r.arreLaterales || 0) + (r.arreCabeceras || 0) + (r.defectosEstampado?.totalEstampado || 0))),
      'TOTAL SEGUNDAS (FÓRMULA)': r.totalSegundas || 0,
      '% TOTAL SEGUNDAS': `${((r.pctTotalSegundas || 0) * 100).toFixed(2)}%`,
      'OBSERVACIONES': r.observaciones || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Segundas y Primeras');
    XLSX.writeFile(wb, `Reporte_Segundas_Calidad_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', 'Reporte Excel Descargado', 'El archivo de inspección de calidad se ha guardado exitosamente.');
  };

  // ── ACCESOS RÁPIDOS A RANGOS TEMPORALES PRECONFIGURADOS ──
  const applyQuickDatePreset = (preset: 'week' | 'quincena_1' | 'quincena_2' | 'month' | 'prev_month' | 'compare_prev') => {
    setActiveDatePreset(preset);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (preset === 'month') {
      setTimeFilter('month');
      setSelectedMonth(curMonth);
      setSelectedYear(curYear);
      showToast('info', 'Filtro Aplicado: Mes Actual', `${MONTH_NAMES[curMonth]} ${curYear}`);
      return;
    }

    if (preset === 'prev_month') {
      const prevM = curMonth === 0 ? 11 : curMonth - 1;
      const prevY = curMonth === 0 ? curYear - 1 : curYear;
      setTimeFilter('month');
      setSelectedMonth(prevM);
      setSelectedYear(prevY);
      showToast('info', 'Filtro Aplicado: Mes Anterior', `${MONTH_NAMES[prevM]} ${prevY}`);
      return;
    }

    if (preset === 'compare_prev') {
      setTimeFilter('month');
      setMonthlyComparisonScope('filtered');
      const elem = document.getElementById('seccion-comparativa-mom');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('info', 'Comparativa Mes Anterior', 'Enfocando panel de comparativa MoM.');
      return;
    }

    if (preset === 'week') {
      const end = now.toISOString().slice(0, 10);
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(past);
      setEndDate(end);
      setTimeFilter('range');
      showToast('info', 'Filtro: Última Semana', `${past} al ${end}`);
      return;
    }

    if (preset === 'quincena_1') {
      const y = curYear;
      const mStr = String(curMonth + 1).padStart(2, '0');
      setStartDate(`${y}-${mStr}-01`);
      setEndDate(`${y}-${mStr}-15`);
      setTimeFilter('range');
      showToast('info', 'Filtro: 1ª Quincena del Mes', `01 al 15 de ${MONTH_NAMES[curMonth]}`);
      return;
    }

    if (preset === 'quincena_2') {
      const y = curYear;
      const mStr = String(curMonth + 1).padStart(2, '0');
      const lastDay = new Date(y, curMonth + 1, 0).getDate();
      setStartDate(`${y}-${mStr}-16`);
      setEndDate(`${y}-${mStr}-${String(lastDay).padStart(2, '0')}`);
      setTimeFilter('range');
      showToast('info', 'Filtro: 2ª Quincena del Mes', `16 al ${lastDay} de ${MONTH_NAMES[curMonth]}`);
      return;
    }
  };

  // ── EXPORTACIÓN DE INFORME EJECUTIVO DIARIO A PDF (JEFES DE PLANTA/TALLER) ──
  const exportExecutiveSummaryPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const now = new Date();
      const emissionDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const periodLabel = timeFilter === 'month' ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
        : timeFilter === 'year' ? `Año ${selectedYear}`
        : timeFilter === 'range' ? `${startDate} al ${endDate}`
        : 'Histórico Completo';

      // 1. Cabecera Corporativa
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(14, 12, 182, 24, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('CONTEX S.A.S. — CONTROL DE CALIDAD Y SEGUNDAS', 20, 22);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Período: ${periodLabel}   |   Emisión: ${emissionDate}`, 20, 30);

      let currentY = 41;

      // 2. Tarjetas de KPIs Clave
      const cardW = 43.5;
      const cardH = 20;

      // Total Revisadas
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('TOTAL REVISADAS', 17, currentY + 5);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(fmtInt(totals.revisada), 17, currentY + 12);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('100% Volumen evaluado', 17, currentY + 17);

      // Buenas (1ª Calidad)
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(14 + cardW + 2.6, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('1ª CALIDAD (BUENAS)', 14 + cardW + 5.6, currentY + 5);
      doc.setFontSize(11);
      doc.setTextColor(6, 95, 70);
      doc.text(`${fmtInt(totals.buena)} (${fmtPct(pctGlobalBuena)})`, 14 + cardW + 5.6, currentY + 12);
      doc.setFontSize(7);
      doc.setTextColor(16, 185, 129);
      doc.text('Rendimiento conforme', 14 + cardW + 5.6, currentY + 17);

      // Total Segundas
      const isSegHigh = pctGlobalSegundas >= 0.08;
      const isSegMed = pctGlobalSegundas >= 0.04 && !isSegHigh;
      doc.setFillColor(isSegHigh ? 255 : isSegMed ? 254 : 240, isSegHigh ? 241 : isSegMed ? 243 : 253, isSegHigh ? 242 : isSegMed ? 199 : 244);
      doc.setDrawColor(isSegHigh ? 253 : isSegMed ? 251 : 167, isSegHigh ? 164 : isSegMed ? 191 : 243, isSegHigh ? 175 : isSegMed ? 36 : 208);
      doc.roundedRect(14 + (cardW + 2.6) * 2, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isSegHigh ? 190 : isSegMed ? 180 : 5, isSegHigh ? 18 : isSegMed ? 83 : 150, isSegHigh ? 60 : isSegMed ? 9 : 105);
      doc.text('TOTAL SEGUNDAS', 14 + (cardW + 2.6) * 2 + 3, currentY + 5);
      doc.setFontSize(11);
      doc.text(`${fmtInt(totals.totalSegundas)} (${fmtPct(pctGlobalSegundas)})`, 14 + (cardW + 2.6) * 2 + 3, currentY + 12);
      doc.setFontSize(7);
      doc.text(isSegHigh ? 'ALERTA: Supera umbral' : isSegMed ? 'Precaución en taller' : 'Dentro de meta', 14 + (cardW + 2.6) * 2 + 3, currentY + 17);

      // Arreglos y Pegas
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(186, 230, 253);
      doc.roundedRect(14 + (cardW + 2.6) * 3, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text('ARREGLOS + PEGAS', 14 + (cardW + 2.6) * 3 + 3, currentY + 5);
      doc.setFontSize(11);
      doc.setTextColor(3, 105, 161);
      const totalArrPeg = totals.arreCabeceras + totals.arreLaterales + totals.pegas;
      doc.text(`${fmtInt(totalArrPeg)} (${fmtPct(totalArrPeg / (totals.revisada || 1))})`, 14 + (cardW + 2.6) * 3 + 3, currentY + 12);
      doc.setFontSize(7);
      doc.setTextColor(14, 165, 233);
      doc.text(`Cab: ${fmtInt(totals.arreCabeceras)} | Lat: ${fmtInt(totals.arreLaterales)}`, 14 + (cardW + 2.6) * 3 + 3, currentY + 17);

      currentY += cardH + 7;

      // 3. Distribución por Procesos
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Distribución de Segundas y Reprocesos por Proceso Textil', 14, currentY);
      currentY += 3;

      autoTable(doc, {
        startY: currentY,
        head: [['Área / Reproceso', 'Piezas Evaluadas / Fallas', '% Incidencia', 'Estado Operativo']],
        body: [
          ['1ª Calidad (Conforme)', `${fmtInt(totals.buena)} pz`, fmtPct(pctGlobalBuena), 'Conforme'],
          ['Estampado (Taller Propio)', `${fmtInt(totals.estampado)} pz`, fmtPct(pctGlobalEstampado), pctGlobalEstampado > 0.04 ? 'Alerta Taller' : 'Normal'],
          ['Arreglos Cabeceras (Dobladillo)', `${fmtInt(totals.arreCabeceras)} pz`, fmtPct(pctGlobalCabeceras), pctGlobalCabeceras > 0.05 ? 'Reproceso Alto' : 'Normal'],
          ['Arreglos Laterales (Orillos)', `${fmtInt(totals.arreLaterales)} pz`, fmtPct(pctGlobalLaterales), pctGlobalLaterales > 0.05 ? 'Reproceso Alto' : 'Normal'],
          ['Pegas (Empalmes de rollo)', `${fmtInt(totals.pegas)} pz`, fmtPct(pctGlobalPegas), 'Operativo'],
          ['Tintorería / Acabado húmedo', `${fmtInt(totals.tintoreria)} pz`, fmtPct(pctGlobalTintoreria), pctGlobalTintoreria > 0.03 ? 'Revisión Proveedor' : 'Normal'],
          ['Tejeduría / Hilatura', `${fmtInt(totals.tejeduria)} pz`, fmtPct(pctGlobalTejeduria), 'Normal'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 4. Tabla de Top Diseños Críticos
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Top Diseños con Mayor Impacto de Segundas (Fallas)', 14, currentY);
      currentY += 3;

      const topRows = allTopDesigns
        .sort((a, b) => b.totalSegundas - a.totalSegundas)
        .slice(0, 8)
        .map((d, idx) => [
          `#${idx + 1}`,
          d.name,
          d.process,
          d.referencia || '-',
          fmtInt(d.totalRevisadas),
          fmtInt(d.totalSegundas),
          `${d.pctSegundas}%`,
          d.topDefecto ? `${d.topDefecto} (${d.topDefectoCant})` : 'Sin fallas',
          d.pctSegundas >= 8 ? 'CRÍTICO' : d.pctSegundas >= 4 ? 'ALERTA' : 'NORMAL'
        ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Diseño', 'Técnica', 'Tela', 'Revisadas', 'Segundas', '% Seg', 'Defecto Principal', 'Nivel']],
        body: topRows,
        theme: 'striped',
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Validaciones y Aprobación de Planta:', 14, currentY);

      currentY += 12;
      doc.setDrawColor(203, 213, 225);
      doc.line(14, currentY, 80, currentY);
      doc.line(116, currentY, 182, currentY);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Supervisor de Calidad y Laboratorio', 14, currentY + 4);
      doc.text('Jefe de Planta / Producción Taller', 116, currentY + 4);

      doc.save(`Informe_Calidad_Contex_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('success', 'PDF Generado', 'El informe diario para jefes de planta se descargó exitosamente.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al exportar', 'No se pudo generar el informe en PDF.');
    }
  };

  // ── EXPORTACIÓN DE TOP DISEÑOS A PDF ──
  const exportTopDesignsPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const now = new Date();
      const emissionDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
      const periodLabel = timeFilter === 'month' ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
        : timeFilter === 'year' ? `Año ${selectedYear}`
        : timeFilter === 'range' ? `${startDate} al ${endDate}`
        : 'Histórico Completo';

      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(14, 12, 182, 24, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('CONTEX — RANKING TOP DISEÑOS DE CALIDAD Y SEGUNDAS', 20, 22);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Período: ${periodLabel}   |   Métrica: ${TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.label}   |   Fecha: ${emissionDate}`, 20, 30);

      const tableRows = activeTopDesignsList.map((d, idx) => [
        `#${idx + 1}`,
        d.name,
        d.process,
        d.referencia || '-',
        fmtInt(d.totalRevisadas),
        fmtInt(d.buenas),
        fmtInt(d.totalSegundas),
        `${d.pctSegundas}%`,
        d.topDefecto ? `${d.topDefecto} (${d.topDefectoCant})` : 'Sin fallas',
        d.pctSegundas >= 8 ? 'CRÍTICO' : d.pctSegundas >= 4 ? 'ALERTA' : 'NORMAL'
      ]);

      autoTable(doc, {
        startY: 42,
        head: [['#', 'Diseño', 'Técnica', 'Tela', 'Revisadas', 'Buenas', 'Segundas', '% Seg', 'Defecto Principal', 'Nivel']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Top_Disenos_Calidad_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('success', 'Reporte PDF Descargado', 'El reporte de Top Diseños se guardó exitosamente.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error PDF', 'No se pudo generar el reporte PDF.');
    }
  };

  // ── DESCARGA DIRECTA DE GRÁFICA TOP DISEÑOS COMO IMAGEN PNG ──
  const exportTopDesignsImage = () => {
    try {
      const container = document.getElementById('top-designs-chart-container');
      const svg = container ? container.querySelector('svg') : null;
      if (!svg) {
        showToast('error', 'Gráfico no disponible', 'No se encontró el elemento visual del gráfico.');
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgSize = svg.getBoundingClientRect();
      const scale = 2; // Alta resolución
      canvas.width = (svgSize.width || 600) * scale;
      canvas.height = (svgSize.height || 400) * scale;

      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const urlObj = window.URL || (window as any).webkitURL;
      const blobURL = urlObj.createObjectURL(svgBlob);

      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `Top_Disenos_Grafico_${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          urlObj.revokeObjectURL(blobURL);
          showToast('success', 'Imagen PNG Descargada', 'Gráfico exportado exitosamente en alta resolución.');
        }
      };
      img.src = blobURL;
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al exportar imagen', 'Ocurrió un problema al convertir el gráfico a imagen.');
    }
  };

  // ── DESGLOSE DE LOTES EXACTOS PARA EL MODAL DE REPROCESOS Y PEGAS ──
  const reprocesoLots = useMemo(() => {
    if (!reprocesoModal) return [];
    return visibleRecords
      .map(r => {
        let count = 0;
        if (reprocesoModal.type === 'cabeceras') count = r.arreCabeceras || 0;
        else if (reprocesoModal.type === 'laterales') count = r.arreLaterales || 0;
        else if (reprocesoModal.type === 'pegas') count = r.pegas || 0;
        else if (reprocesoModal.type === 'estampado') count = r.defectosEstampado?.totalEstampado || 0;
        else if (reprocesoModal.type === 'tintoreria') count = r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0;
        else if (reprocesoModal.type === 'tejeduria') count = r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0;
        else if (reprocesoModal.type === 'tundido') count = r.defectosCostura?.tundidoCaido ?? 0;
        else if (reprocesoModal.type === 'montadas') count = r.defectosCostura?.montadasCostura ?? 0;
        else if (reprocesoModal.type === 'manchas_negras') count = (r.defectosCostura?.manchasNegras ?? 0) + (r.defectosCostura?.enganches ?? 0);
        else if (reprocesoModal.type === 'rotas') count = r.rotas ?? 0;

        const totalRev = r.cantTotalRevisada || 1;
        const pct = (count / totalRev) * 100;
        return {
          ...r,
          faultCount: count,
          faultPct: Number(pct.toFixed(2))
        };
      })
      .filter(r => r.faultCount > 0)
      .filter(r => {
        if (!reprocesoModalSearch.trim()) return true;
        const q = reprocesoModalSearch.trim().toLowerCase();
        return (r.diseno || '').toLowerCase().includes(q) ||
               (r.revisadoras || '').toLowerCase().includes(q) ||
               (r.referencia || '').toLowerCase().includes(q) ||
               (r.observaciones || '').toLowerCase().includes(q);
      })
      .filter(r => {
        if (reprocesoModalRef === 'all') return true;
        return (r.referencia || '').toUpperCase() === reprocesoModalRef.toUpperCase();
      })
      .sort((a, b) => {
        if (reprocesoModalSort === 'defects_desc') return b.faultCount - a.faultCount;
        return b.fecha.localeCompare(a.fecha);
      });
  }, [visibleRecords, reprocesoModal, reprocesoModalSearch, reprocesoModalRef, reprocesoModalSort]);

  const exportReprocesoModalExcel = () => {
    if (!reprocesoModal) return;
    const rows = reprocesoLots.map(r => ({
      'FECHA': r.fecha,
      'DISEÑO': r.diseno,
      'TÉCNICA': r.tecnica || inferTecnica(r.diseno, r.referencia),
      'REFERENCIA': r.referencia,
      'REVISADORAS': r.revisadoras,
      'TOTAL REVISADAS': r.cantTotalRevisada,
      [reprocesoModal.type === 'cabeceras' || reprocesoModal.type === 'laterales' ? 'ARREGLOS (REPROCESO)' : reprocesoModal.type === 'pegas' ? 'PEGAS' : 'SEGUNDAS (FALLAS)']: r.faultCount,
      '% INCIDENCIA': `${r.faultPct}%`,
      '1ª CALIDAD': r.cantBuena,
      'TOTAL SEGUNDAS': r.totalSegundas,
      'OBSERVACIONES': r.observaciones || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Reproceso');
    XLSX.writeFile(wb, `Detalle_${reprocesoModal.type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', 'Excel Descargado', `Reporte de ${reprocesoModal.title} guardado.`);
  };

  const exportReprocesoModalPDF = () => {
    if (!reprocesoModal) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const now = new Date();
      const emissionDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(14, 12, 182, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`CONTEX — DESGLOSE OPERATIVO: ${reprocesoModal.title.toUpperCase()}`, 20, 21);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Total Lotes Afectados: ${reprocesoLots.length}   |   Fecha de Emisión: ${emissionDate}`, 20, 28);

      const tableRows = reprocesoLots.slice(0, 30).map(r => [
        r.fecha,
        r.diseno,
        r.referencia || '-',
        r.revisadoras || '-',
        fmtInt(r.cantTotalRevisada),
        fmtInt(r.faultCount),
        `${r.faultPct}%`,
        r.observaciones ? r.observaciones.slice(0, 30) : '-'
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['Fecha', 'Diseño', 'Tela', 'Auditor', 'Revisadas', 'Fallas', '% Incid.', 'Observaciones']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Desglose_${reprocesoModal.type}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('success', 'PDF Descargado', 'Listado de lotes generado en PDF.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al generar PDF', 'No se pudo generar el documento.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── BARRA SUPERIOR DE FILTRO TEMPORAL, TÉCNICA Y REFERENCIA ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegador de Mes / Año */}
          {timeFilter === 'month' && (
            <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2.5 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                <span>{MONTH_NAMES[selectedMonth]}</span>
                <span className="text-slate-400 font-semibold">{selectedYear}</span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Botón rápido para volver al Mes Actual si se navegó a otro mes */}
          {timeFilter === 'month' && (selectedMonth !== new Date().getMonth() || selectedYear !== new Date().getFullYear()) && (
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setSelectedMonth(now.getMonth());
                setSelectedYear(now.getFullYear());
              }}
              className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1 animate-in fade-in"
              title="Volver al mes actual"
            >
              <Calendar className="w-3 h-3 text-rose-500" />
              <span>Ir a Mes Actual</span>
            </button>
          )}

          {timeFilter === 'year' && (
            <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedYear(y => y - 1)}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                <span>{selectedYear}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedYear(y => y + 1)}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chips de Periodo */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
            {[
              { id: 'all', label: 'Todo el Histórico' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' },
              { id: 'range', label: 'Rango' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setTimeFilter(f.id as any);
                  setActiveDatePreset('none');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === f.id
                    ? 'bg-white text-rose-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── ACCESOS DIRECTOS ÁGILES A RANGOS PRECONFIGURADOS (1 CLIC) ── */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-xl text-[11px] shadow-2xs">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 mr-0.5">
              <Zap className="w-3 h-3 text-amber-500" />
              Rápidos:
            </span>
            <button
              type="button"
              onClick={() => applyQuickDatePreset('week')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDatePreset === 'week' && timeFilter === 'range'
                  ? 'bg-white text-rose-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Filtrar los últimos 7 días con 1 clic"
            >
              Última semana
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                if (now.getDate() <= 15) applyQuickDatePreset('quincena_1');
                else applyQuickDatePreset('quincena_2');
              }}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                (activeDatePreset === 'quincena_1' || activeDatePreset === 'quincena_2') && timeFilter === 'range'
                  ? 'bg-white text-rose-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Filtrar la quincena actual con 1 clic"
            >
              Quincena actual
            </button>
            <button
              type="button"
              onClick={() => applyQuickDatePreset('prev_month')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDatePreset === 'prev_month' && timeFilter === 'month'
                  ? 'bg-white text-rose-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Navegar al mes anterior con 1 clic"
            >
              Mes anterior
            </button>
            <button
              type="button"
              onClick={() => applyQuickDatePreset('compare_prev')}
              className="px-2 py-0.5 rounded-lg text-xs font-bold text-purple-700 hover:bg-purple-100/80 transition-all cursor-pointer flex items-center gap-1 border border-purple-200/60 bg-purple-50/60"
              title="Comparar mes actual contra mes anterior con 1 solo clic"
            >
              <GitCompare className="w-3 h-3 text-purple-600" />
              <span>Comparar MoM</span>
            </button>
          </div>

          {/* Selector de Rango Personalizado de Fechas */}
          {timeFilter === 'range' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 rounded-xl p-1 shadow-2xs animate-in fade-in duration-100">
              <span className="text-[10px] font-black text-slate-500 uppercase px-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                Rango:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-slate-400 text-xs font-bold">a</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                    setStartDate(`${y}-${m}-01`);
                    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Mes Actual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const end = now.toISOString().slice(0, 10);
                    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    setStartDate(past);
                    setEndDate(end);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Últimos 30 días
                </button>
                {availableMonthsInRecords.slice(0, 2).map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => {
                      const y = m.year;
                      const monthStr = String(m.month + 1).padStart(2, '0');
                      const lastDay = new Date(y, m.month + 1, 0).getDate();
                      setStartDate(`${y}-${monthStr}-01`);
                      setEndDate(`${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`);
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 rounded border border-slate-200 transition-colors cursor-pointer"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* Filtro por Tela Base (C280T, ME1002, ML1002) */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase px-1.5">REF:</span>
            <button
              type="button"
              onClick={() => setReferenciaFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                referenciaFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            {availableReferences.map(ref => (
              <button
                key={ref}
                type="button"
                onClick={() => setReferenciaFilter(ref)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  referenciaFilter === ref
                    ? 'bg-blue-600 text-white shadow-2xs font-black'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                {ref}
              </button>
            ))}
          </div>

          {/* Filtro Técnica */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('all');
                setTopDesignProcessFilter('all');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Técnicas
            </button>
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('REACTIVO');
                setTopDesignProcessFilter('REACTIVO');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'REACTIVO'
                  ? 'bg-purple-600 text-white shadow-2xs font-black'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              Reactivo
            </button>
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('PIGMENTO');
                setTopDesignProcessFilter('PIGMENTO');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'PIGMENTO'
                  ? 'bg-amber-600 text-white shadow-2xs font-black'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Pigmento
            </button>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Badge de Sincronización en la Nube Firestore */}
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200/90 rounded-xl transition-all shadow-2xs"
            title="Base de datos Cloud Firestore activa. Sincronización multi-dispositivo y multi-origen en tiempo real."
          >
            <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline text-sky-900 font-extrabold">Nube:</span>
            <span className="text-sky-700 font-semibold">{isCloudSyncing ? 'Conectando...' : 'Sincronizado'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs animate-pulse" title="Conexión en vivo activa" />
          </div>

          {/* Badge y Botón de Estado del Último Archivo Excel Cargado */}
          <button
            type="button"
            onClick={() => setIsImportAuditDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 rounded-xl transition-all cursor-pointer shadow-2xs group"
            title="Ver informe de estado y validación de columnas del último archivo Excel procesado"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline text-slate-500 font-medium">Estado Archivo:</span>
            <span className="font-mono text-emerald-800 font-extrabold max-w-[110px] truncate">
              {lastImportAudit.fileName}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs" title="Columnas Validadas" />
          </button>

          {/* Botón Prominente de Carga de Excel */}
          <label className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl cursor-pointer transition-all border border-emerald-500/50 shadow-sm shadow-emerald-600/25 ring-2 ring-emerald-500/20">
            <Upload className="w-3.5 h-3.5 text-emerald-100" />
            <span>Cargar Excel</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl cursor-pointer transition-all shadow-2xs"
            title="Exportar planilla completa a archivo Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl cursor-pointer transition-all shadow-2xs"
            title="Personalizar y generar informe PDF para jefes de planta (elegir gráficas, tiempo, MoM, año, rango)"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Informe PDF</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inspección</span>
          </button>
        </div>
      </div>

      {/* ── ALERTA INFORMATIVA SI EL FILTRO NO TIENE DATOS ── */}
      {timeFilteredRecords.length === 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Calendar className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                {timeFilter === 'month' && `No hay registros de inspección registrados en ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                {timeFilter === 'year' && `No hay registros de inspección registrados en el año ${selectedYear}`}
                {timeFilter === 'range' && `No hay registros de inspección en el rango seleccionado (${startDate} al ${endDate})`}
                {timeFilter === 'all' && 'No hay registros que coincidan con los filtros aplicados'}
              </p>
              <div className="text-[11px] text-amber-800 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>Meses con datos en el historial:</span>
                {availableMonthsInRecords.length > 0 ? (
                  availableMonthsInRecords.map(m => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(m.month);
                        setSelectedYear(m.year);
                        setTimeFilter('month');
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-md font-bold text-amber-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      {m.label} ({m.count} lotes)
                    </button>
                  ))
                ) : (
                  <span className="italic">No hay datos aún. Haz clic en "Cargar Excel" para importar el archivo del mes.</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            Ver Todo el Histórico ({records.length})
          </button>
        </div>
      )}

      {/* ── KPI CARDS EJECUTIVOS: 4 BLOQUES ESTRUCTURADOS ── */}
      <div className="space-y-3">
        {/* BLOQUE 1: INSPECCIÓN PRINCIPAL (3 TARJETAS) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-600" />
              1. Balance General de Inspección
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 shadow-2xs transition-all cursor-pointer"
                title="Personalizar y descargar informe PDF (elegir período, MoM y gráficas)"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>Informe Diario PDF</span>
              </button>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                {timeFilteredRecords.length} lotes evaluados
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* 1.1 Total Revisadas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 hover:border-slate-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide leading-tight">
                  Total Revisadas
                </p>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {fmtInt(totals.revisada)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    100%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight truncate">
                  {timeFilteredRecords.length} lotes evaluados
                </p>
              </div>
            </div>

            {/* 1.2 1ª Calidad (Buenas) */}
            <div className="bg-white rounded-2xl border border-emerald-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-emerald-50/20 hover:border-emerald-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-extrabold text-emerald-600 uppercase tracking-wide leading-tight">
                  1ª Calidad (Buenas)
                </p>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
                    {fmtInt(totals.buena)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalBuena)}
                  </span>
                </div>
              </div>
            </div>

            {/* 1.3 Total Segundas (Con Indicadores de Alerta Condicional y Umbrales) */}
            {(() => {
              const isCritical = pctGlobalSegundas >= 0.08 || (monthOverMonthStats?.hasPrev && (monthOverMonthStats.deltaSegundas || 0) >= 1.5);
              const isWarning = !isCritical && (pctGlobalSegundas >= 0.04 || (monthOverMonthStats?.hasPrev && (monthOverMonthStats.deltaSegundas || 0) > 0));
              const cardBorder = isCritical ? 'border-rose-300 hover:border-rose-400' : isWarning ? 'border-amber-300 hover:border-amber-400' : 'border-emerald-300 hover:border-emerald-400';
              const cardBg = isCritical ? 'bg-gradient-to-br from-white via-rose-50/30 to-rose-100/20' : isWarning ? 'bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20' : 'bg-gradient-to-br from-white via-emerald-50/30 to-emerald-100/20';
              const iconBg = isCritical ? 'bg-rose-100 text-rose-700 border-rose-200' : isWarning ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
              const badgeClass = isCritical ? 'bg-rose-100 text-rose-800 border-rose-300' : isWarning ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300';
              const badgeLabel = isCritical ? '🔴 Supera Umbral (≥8%)' : isWarning ? '🟡 Alerta Moderada (4-8%)' : '🟢 Meta Conforme (<4%)';

              return (
                <div className={`bg-white rounded-2xl border ${cardBorder} ${cardBg} p-3 sm:p-3.5 shadow-xs flex items-center gap-3 transition-all relative overflow-hidden`}>
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 border`}>
                    {isCritical ? <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-tight ${isCritical ? 'text-rose-700' : isWarning ? 'text-amber-800' : 'text-emerald-800'}`}>
                        Total Segundas
                      </p>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md border ${badgeClass} shrink-0`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                      <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${isCritical ? 'text-rose-900' : isWarning ? 'text-amber-900' : 'text-emerald-900'}`}>
                        {fmtInt(totals.totalSegundas)}
                      </span>
                      <span className={`text-sm sm:text-base font-black px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs border ${badgeClass}`}>
                        {fmtPct(pctGlobalSegundas)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px]">
            
                      {monthOverMonthStats?.hasPrev && (
                        <span className={`font-mono font-bold shrink-0 text-[10px] ${monthOverMonthStats.deltaSegundas <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {monthOverMonthStats.deltaSegundas <= 0 ? `▼ ${Math.abs(monthOverMonthStats.deltaSegundas)} pp` : `▲ +${monthOverMonthStats.deltaSegundas} pp`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* BLOQUE 2: ARREGLOS Y PEGAS (INTERACTIVOS CON DESGLOSE DE LOTES) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              2. Arreglos y Pegas (Separados)
            </span>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
              Total Arreglos: {fmtInt(totals.arreCabeceras + totals.arreLaterales)} ({fmtPct(pctGlobalCabeceras + pctGlobalLaterales)})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* 2.1 Arreglos Cabeceras (Clickeable para ver desglose de lotes) */}
            {(() => {
              const isHigh = pctGlobalCabeceras >= 0.05;
              const isMed = pctGlobalCabeceras >= 0.025 && !isHigh;
              const borderCol = isHigh ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20' : isMed ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20' : 'border-cyan-200/90 hover:border-cyan-400 bg-cyan-50/20';

              return (
                <div
                  onClick={() => setReprocesoModal({
                    type: 'cabeceras',
                    title: 'Arreglos Cabeceras (Dobladillo)',
                    subtitle: 'Lotes exactos que generaron reproceso en dobladillos de cabecera',
                    badgeColor: 'cyan'
                  })}
                  className={`bg-white rounded-2xl border ${borderCol} p-3 sm:p-3.5 shadow-xs flex items-center gap-3 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]`}
                  title="Hacer clic para ver el desglose de los lotes exactos con arreglos de cabecera"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100 group-hover:bg-cyan-100 group-hover:scale-105 transition-all">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10px] sm:text-[11px] font-extrabold text-cyan-700 uppercase tracking-wide leading-tight truncate">
                        Arreglos Cabeceras
                      </p>
                      <span className="text-[9px] font-extrabold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-cyan-100">
                        <Search className="w-2.5 h-2.5" />
                        <span>Ver lotes</span>
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-cyan-800 font-mono tracking-tight">
                        {fmtInt(totals.arreCabeceras)}
                      </span>
                      <span className={`text-sm sm:text-base font-black px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs border ${
                        isHigh ? 'bg-rose-50 text-rose-700 border-rose-200' : isMed ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                      }`}>
                        {fmtPct(pctGlobalCabeceras)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2.2 Arreglos Laterales (Clickeable para ver desglose de lotes) */}
            {(() => {
              const isHigh = pctGlobalLaterales >= 0.05;
              const isMed = pctGlobalLaterales >= 0.025 && !isHigh;
              const borderCol = isHigh ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20' : isMed ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20' : 'border-sky-200/90 hover:border-sky-400 bg-sky-50/20';

              return (
                <div
                  onClick={() => setReprocesoModal({
                    type: 'laterales',
                    title: 'Arreglos Laterales (Orillos)',
                    subtitle: 'Lotes exactos que generaron reproceso en dobladillos de orillos laterales',
                    badgeColor: 'sky'
                  })}
                  className={`bg-white rounded-2xl border ${borderCol} p-3 sm:p-3.5 shadow-xs flex items-center gap-3 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]`}
                  title="Hacer clic para ver el desglose de los lotes exactos con arreglos laterales"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 group-hover:bg-sky-100 group-hover:scale-105 transition-all">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10px] sm:text-[11px] font-extrabold text-sky-700 uppercase tracking-wide leading-tight truncate">
                        Arreglos Laterales
                      </p>
                      <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-sky-100">
                        <Search className="w-2.5 h-2.5" />
                        <span>Ver lotes</span>
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-sky-800 font-mono tracking-tight">
                        {fmtInt(totals.arreLaterales)}
                      </span>
                      <span className={`text-sm sm:text-base font-black px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs border ${
                        isHigh ? 'bg-rose-50 text-rose-700 border-rose-200' : isMed ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        {fmtPct(pctGlobalLaterales)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2.3 Pegas (Empalmes de Rollo - Clickeable) */}
            <div
              onClick={() => setReprocesoModal({
                type: 'pegas',
                title: 'Pegas (Empalmes de Rollo)',
                subtitle: 'Lotes que registraron empalmes de rollo evaluados',
                badgeColor: 'indigo'
              })}
              className="bg-white rounded-2xl border border-indigo-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-indigo-50/20 hover:border-indigo-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con empalmes de rollo"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-100 group-hover:scale-105 transition-all">
                <Scissors className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide leading-tight truncate">
                    Pegas (Empalmes)
                  </p>
                  <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-indigo-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver lotes</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-indigo-800 font-mono tracking-tight">
                    {fmtInt(totals.pegas)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-indigo-700 bg-indigo-50 border border-indigo-200/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalPegas)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE 3: ESTAMPADO, TINTORERÍA Y TEJEDURÍA (3 TARJETAS) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-rose-600" />
              3. Segundas por Proceso Textil
            </span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
              Total Procesos: {fmtInt(totals.estampado + totals.tintoreria + totals.tejeduria)} ({fmtPct(pctGlobalEstampado + pctGlobalTintoreria + pctGlobalTejeduria)})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* 3.1 Estampado (Taller) - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'estampado',
                title: 'Defectos de Estampado (Taller)',
                subtitle: 'Lotes con manchas, repise, falta de pintura u otras fallas de estampación',
                badgeColor: 'rose'
              })}
              className="bg-white rounded-2xl border border-rose-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-rose-50/20 hover:border-rose-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con fallas de estampado"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 group-hover:bg-rose-100 group-hover:scale-105 transition-all">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-rose-600 uppercase tracking-wide leading-tight truncate">
                    Estampado
                  </p>
                  <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-rose-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver lotes</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-rose-700 font-mono tracking-tight">
                    {fmtInt(totals.estampado)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-rose-700 bg-rose-50 border border-rose-200/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalEstampado)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-rose-600 font-extrabold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.estampado / totals.totalSegundas) * 100).toFixed(0) : 0}% de segundas)
                </p>
              </div>
            </div>

            {/* 3.2 Tintorería - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'tintoreria',
                title: 'Fallas de Tintorería y Lavandería',
                subtitle: 'Lotes con manchas de tintura, sucias u óxido de proveedores',
                badgeColor: 'cyan'
              })}
              className="bg-white rounded-2xl border border-cyan-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-cyan-50/20 hover:border-cyan-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con fallas de tintorería"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100 group-hover:bg-cyan-100 group-hover:scale-105 transition-all">
                <Droplets className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-cyan-700 uppercase tracking-wide leading-tight truncate">
                    Tintorería
                  </p>
                  <span className="text-[9px] font-extrabold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-cyan-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver lotes</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-cyan-900 font-mono tracking-tight">
                    {fmtInt(totals.tintoreria)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-cyan-800 bg-cyan-50 border border-cyan-200/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalTintoreria)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-cyan-700 font-bold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.tintoreria / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>

            {/* 3.3 Tejeduría - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'tejeduria',
                title: 'Fallas de Tejeduría e Hilatura',
                subtitle: 'Lotes con reviente de urdimbre, trama, marras o variaciones de rizo',
                badgeColor: 'emerald'
              })}
              className="bg-white rounded-2xl border border-emerald-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-emerald-50/20 hover:border-emerald-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con fallas de tejeduría"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-emerald-700 uppercase tracking-wide leading-tight truncate">
                    Tejeduría
                  </p>
                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-emerald-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver lotes</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono tracking-tight">
                    {fmtInt(totals.tejeduria)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-800 bg-emerald-50 border border-emerald-300/90 px-2.5 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalTejeduria)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-emerald-700 font-bold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.tejeduria / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE 4: TUNDIDO, MONTADAS, MANCHAS Y ROTAS (4 TARJETAS) - CLICKEABLES */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              4. Acabado, Confección y Fallas Físicas
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
              Total Físicas: {fmtInt(totals.tundido + totals.montadas + totals.manchasNegras + totals.rotas)} ({fmtPct(pctGlobalTundido + pctGlobalMontadas + pctGlobalManchasNegras + pctGlobalRotas)})
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* 4.1 Tundido Caído - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'tundido',
                title: 'Fallas de Tundido Caído',
                subtitle: 'Lotes afectados por problemas de tundido en proceso de acabado',
                badgeColor: 'purple'
              })}
              className="bg-white rounded-2xl border border-purple-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5 bg-gradient-to-br from-white to-purple-50/20 hover:border-purple-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con tundido caído"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 group-hover:bg-purple-100 group-hover:scale-105 transition-all">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-purple-700 uppercase tracking-wide leading-tight truncate">
                    Tundido Caído
                  </p>
                  <span className="text-[8px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-purple-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-0.5">
                  <span className="text-base sm:text-xl font-black text-purple-900 font-mono tracking-tight">
                    {fmtInt(totals.tundido)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-purple-800 bg-purple-50 border border-purple-200/90 px-2 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalTundido)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-purple-700 font-bold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.tundido / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>

            {/* 4.2 Montadas (Costura) - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'montadas',
                title: 'Fallas de Montadas y Costura',
                subtitle: 'Lotes afectados por montadas y defectos de confección / dobladillos',
                badgeColor: 'indigo'
              })}
              className="bg-white rounded-2xl border border-indigo-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5 bg-gradient-to-br from-white to-indigo-50/20 hover:border-indigo-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con montadas de costura"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-100 group-hover:scale-105 transition-all">
                <Scissors className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide leading-tight truncate">
                    Montadas (Costura)
                  </p>
                  <span className="text-[8px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-indigo-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-0.5">
                  <span className="text-base sm:text-xl font-black text-indigo-900 font-mono tracking-tight">
                    {fmtInt(totals.montadas)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-indigo-800 bg-indigo-50 border border-indigo-200/90 px-2 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalMontadas)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-indigo-700 font-bold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.montadas / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>

            {/* 4.3 Manchas Negras - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'manchas_negras',
                title: 'Manchas Negras y Enganches',
                subtitle: 'Lotes con manchas negras y enganches detectados en acabado',
                badgeColor: 'slate'
              })}
              className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5 bg-gradient-to-br from-white to-slate-50/40 hover:border-slate-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con manchas negras o enganches"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-slate-200 group-hover:scale-105 transition-all">
                <AlertCircle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 uppercase tracking-wide leading-tight truncate">
                    Manchas Negras
                  </p>
                  <span className="text-[8px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-slate-200">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-0.5">
                  <span className="text-base sm:text-xl font-black text-slate-900 font-mono tracking-tight">
                    {fmtInt(totals.manchasNegras)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-800 bg-slate-100 border border-slate-300/90 px-2 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalManchasNegras)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold leading-tight truncate mt-0.5">
                  ({totals.totalSegundas > 0 ? ((totals.manchasNegras / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>

            {/* 4.4 Telas Rotas - Clickeable */}
            <div
              onClick={() => setReprocesoModal({
                type: 'rotas',
                title: 'Telas Rotas y Daños Físicos',
                subtitle: 'Lotes con roturas de tela, perforaciones o rasgaduras',
                badgeColor: 'red'
              })}
              className="bg-white rounded-2xl border border-red-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5 bg-gradient-to-br from-white to-red-50/20 hover:border-red-400 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.01]"
              title="Hacer clic para ver los lotes con telas rotas"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100 group-hover:bg-red-100 group-hover:scale-105 transition-all">
                <ShieldAlert className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-red-700 uppercase tracking-wide leading-tight truncate">
                    Telas Rotas
                  </p>
                  <span className="text-[8px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 group-hover:bg-red-100">
                    <Search className="w-2.5 h-2.5" />
                    <span>Ver</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-0.5">
                  <span className="text-base sm:text-xl font-black text-red-900 font-mono tracking-tight">
                    {fmtInt(totals.rotas)}
                  </span>
                  <span className="text-sm sm:text-base font-black text-red-700 bg-red-50 border border-red-200/90 px-2 py-0.5 rounded-xl font-mono shrink-0 shadow-2xs">
                    {fmtPct(pctGlobalRotas)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-red-700 font-bold leading-tight truncate mt-0.5">
                   ({totals.totalSegundas > 0 ? ((totals.rotas / totals.totalSegundas) * 100).toFixed(0) : 0}% de seg.)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE SUB-VISTAS PRINCIPALES ── */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-bold text-[11px] hidden md:inline">Vistas de Calidad:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setSubView('resumen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'resumen' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dashboard Comparativo
            </button>
            <button
              type="button"
              onClick={() => setSubView('fallas_ref')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                subView === 'fallas_ref' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Fallas por Diseño
            </button>
            <button
              type="button"
              onClick={() => setSubView('planilla')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'planilla' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {`Planilla (${filteredRecords.length})`}
            </button>
            <button
              type="button"
              onClick={() => setSubView('pareto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'pareto' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matriz
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: DASHBOARD COMPARATIVO PRIMERAS VS SEGUNDAS
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'resumen' && (
        <div className="space-y-4">
          {/* ═════════════════════════════════════════════════════════════
              BLOQUE COMPARATIVO EJECUTIVO (SOLICITADO POR EL USUARIO):
              1. Comparación Mensual Ponderada (Idéntico al Excel de Procesos)
              2. Comparativo General con el Mes Anterior (MoM)
          ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* GRÁFICO 1: COMPARACIÓN MENSUAL PONDERADA (COMO EN LA IMAGEN) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Cabecera del Gráfico con Indicadores de Cambio pp */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80">
                      <BarChart3 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">
                          Comparación mensual ponderada
                        </h3>
                        {/* Selector de alcance: periodo filtrado vs todos los meses */}
                        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setMonthlyComparisonScope('filtered')}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                              monthlyComparisonScope === 'filtered'
                                ? 'bg-white text-rose-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Periodo Activo
                          </button>
                          <button
                            type="button"
                            onClick={() => setMonthlyComparisonScope('all')}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                              monthlyComparisonScope === 'all'
                                ? 'bg-white text-rose-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Todos los meses
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {monthlyComparisonScope === 'all' ? (
                          <span>Comparativa histórica completa de meses (ponderada sobre revisadas)</span>
                        ) : (
                          <>
                            {timeFilter === 'month' && <span>Mostrando proceso textil de {MONTH_NAMES[selectedMonth]} {selectedYear}</span>}
                            {timeFilter === 'year' && <span>Mostrando meses del año {selectedYear}</span>}
                            {timeFilter === 'range' && <span>Mostrando intervalo del {startDate} al {endDate}</span>}
                            {timeFilter === 'all' && <span>Mostrando todo el historial acumulado</span>}
                          </>
                        )}
                        {tecnicaFilter !== 'all' && <span className="ml-1 text-purple-700 font-bold">· {tecnicaFilter}</span>}
                        {referenciaFilter !== 'all' && <span className="ml-1 text-blue-700 font-bold">· {referenciaFilter}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Pills de Cambio vs mes anterior o tasas del mes seleccionado */}
                  {monthOverMonthStats && !monthOverMonthStats.notFound && monthOverMonthStats.current && (
                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                      {monthOverMonthStats.hasPrev ? (
                        <>
                          {/* Pill Estampado */}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono border shadow-2xs ${
                            monthOverMonthStats.deltaEst <= 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span>Estampado: {monthOverMonthStats.deltaEst > 0 ? `+${monthOverMonthStats.deltaEst}` : monthOverMonthStats.deltaEst} pp</span>
                          </span>

                          {/* Pill Tintorería */}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono border shadow-2xs ${
                            monthOverMonthStats.deltaTint <= 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          }`}>
                            <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                            <span>Tintorería: {monthOverMonthStats.deltaTint > 0 ? `+${monthOverMonthStats.deltaTint}` : monthOverMonthStats.deltaTint} pp</span>
                          </span>

                          {/* Pill Tejeduría */}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono border shadow-2xs ${
                            monthOverMonthStats.deltaTej <= 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Tejeduría: {monthOverMonthStats.deltaTej > 0 ? `+${monthOverMonthStats.deltaTej}` : monthOverMonthStats.deltaTej} pp</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span>Estampado: {monthOverMonthStats.current.pctEstampado.toFixed(1).replace('.', ',')}%</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                            <span>Tintorería: {monthOverMonthStats.current.pctTintoreria.toFixed(1).replace('.', ',')}%</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Tejeduría: {monthOverMonthStats.current.pctTejeduria.toFixed(1).replace('.', ',')}%</span>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Gráfica Recharts de Barras Agrupadas */}
                <div className="h-[280px] w-full pt-1">
                  {monthlyProcessComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={monthlyProcessComparisonData}
                        margin={{ top: 22, right: 15, left: -10, bottom: 10 }}
                        barGap={6}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="monthName"
                          tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                          stroke="#cbd5e1"
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          stroke="#cbd5e1"
                          tickLine={false}
                          domain={[0, (dataMax: number) => Math.max(4.0, Math.ceil(dataMax * 1.25))]}
                          tickFormatter={(v) => `${v.toFixed(1).replace('.', ',')}%`}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            if (!d) return null;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[210px]">
                                <p className="font-black text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                                  <span>{d.label}</span>
                                  <span className="font-mono text-slate-400 font-bold">{fmtInt(d.revisadas)} rev.</span>
                                </p>
                                <div className="space-y-1.5 font-mono">
                                  <div className="flex justify-between items-center text-rose-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                                      <span>% Estampado:</span>
                                    </span>
                                    <strong>{d.pctEstampado.toFixed(1).replace('.', ',')}% ({fmtInt(d.estampado)} pz)</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-cyan-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                      <span>% Tintorería*:</span>
                                    </span>
                                    <strong>{d.pctTintoreria.toFixed(1).replace('.', ',')}% ({fmtInt(d.tintoreria)} pz)</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-emerald-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      <span>% Tejeduría:</span>
                                    </span>
                                    <strong>{d.pctTejeduria.toFixed(1).replace('.', ',')}% ({fmtInt(d.tejeduria)} pz)</strong>
                                  </div>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-2 pt-1 border-t border-slate-800 italic">
                                  *Tintorería incluye fallas directas + manchas negras según fórmula de control.
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconType="square"
                          iconSize={10}
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value) => <span className="text-xs text-slate-700 font-bold mx-2">{value}</span>}
                        />
                        <Bar
                          dataKey="pctEstampado"
                          name="% Estampado"
                          fill="#f43f5e"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={44}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="pctEstampado"
                            position="top"
                            formatter={(v: any) => `${Number(v).toFixed(1).replace('.', ',')}%`}
                            style={{ fill: '#e11d48', fontSize: '10px', fontWeight: 800 }}
                          />
                        </Bar>
                        <Bar
                          dataKey="pctTintoreria"
                          name="% Tintorería"
                          fill="#06b6d4"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={44}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="pctTintoreria"
                            position="top"
                            formatter={(v: any) => `${Number(v).toFixed(1).replace('.', ',')}%`}
                            style={{ fill: '#0891b2', fontSize: '10px', fontWeight: 800 }}
                          />
                        </Bar>
                        <Bar
                          dataKey="pctTejeduria"
                          name="% Tejeduría"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={44}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="pctTejeduria"
                            position="top"
                            formatter={(v: any) => `${Number(v).toFixed(1).replace('.', ',')}%`}
                            style={{ fill: '#059669', fontSize: '10px', fontWeight: 800 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 text-xs">
                      <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="font-bold text-slate-600">No hay datos en el periodo seleccionado</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Prueba cambiando de mes, año o rango de fechas</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ficha de Lectura Ejecutiva (Exacto al Excel) */}
              <div className="mt-3 bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    Lectura Ejecutiva (Procesos Textiles)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {monthOverMonthStats?.current ? (
                      monthOverMonthStats.hasPrev ? (
                        <>
                          En <strong>{monthOverMonthStats.current.monthName.toLowerCase()}</strong>, Estampado se ubica en <strong>{monthOverMonthStats.current.pctEstampado.toFixed(1).replace('.', ',')}%</strong>, Tintorería en <strong>{monthOverMonthStats.current.pctTintoreria.toFixed(1).replace('.', ',')}%</strong> y Tejeduría en <strong>{monthOverMonthStats.current.pctTejeduria.toFixed(1).replace('.', ',')}%</strong>. Frente a <strong>{monthOverMonthStats.prev?.monthName.toLowerCase()}</strong>, el cambio fue <strong className={monthOverMonthStats.deltaEst <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{monthOverMonthStats.deltaEst > 0 ? `+${monthOverMonthStats.deltaEst}` : monthOverMonthStats.deltaEst} pp en Estampado</strong>, <strong className={monthOverMonthStats.deltaTint <= 0 ? 'text-emerald-700' : 'text-amber-700'}>{monthOverMonthStats.deltaTint > 0 ? `+${monthOverMonthStats.deltaTint}` : monthOverMonthStats.deltaTint} pp en Tintorería</strong> y <strong className={monthOverMonthStats.deltaTej <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{monthOverMonthStats.deltaTej > 0 ? `+${monthOverMonthStats.deltaTej}` : monthOverMonthStats.deltaTej} pp en Tejeduría</strong>. Una reducción indica menor participación de segundas atribuible al proceso.
                        </>
                      ) : (
                        `En ${monthOverMonthStats.current.monthName.toLowerCase()} (periodo base), Estampado se ubica en ${monthOverMonthStats.current.pctEstampado.toFixed(1).replace('.', ',')}%, Tintorería en ${monthOverMonthStats.current.pctTintoreria.toFixed(1).replace('.', ',')}% y Tejeduría en ${monthOverMonthStats.current.pctTejeduria.toFixed(1).replace('.', ',')}%.`
                      )
                    ) : (
                      'Selecciona un mes o periodo con inspecciones para ver el análisis de calidad.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* GRÁFICO 2: COMPARATIVO GENERAL CON EL MES ANTERIOR */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Cabecera del Comparativo MoM */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
                      <GitCompare className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        Comparativo con el Mes Anterior
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {monthOverMonthStats?.current ? (
                          monthOverMonthStats.hasPrev ? (
                            <span>{monthOverMonthStats.current.monthName} {monthOverMonthStats.current.year} frente a {monthOverMonthStats.prev?.monthName} {monthOverMonthStats.prev?.year}</span>
                          ) : (
                            <span>{monthOverMonthStats.current.monthName} {monthOverMonthStats.current.year} (Línea Base Inicial)</span>
                          )
                        ) : (
                          <span>Sin registros en el periodo seleccionado</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {monthOverMonthStats?.hasPrev && (
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
                      Volumen: {monthOverMonthStats.deltaVolumenPct > 0 ? `+${monthOverMonthStats.deltaVolumenPct}%` : `${monthOverMonthStats.deltaVolumenPct}%`}
                    </span>
                  )}
                </div>

                {/* 4 Cards Resumen MoM */}
                {monthOverMonthStats && !monthOverMonthStats.notFound && monthOverMonthStats.current && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {/* Volumen */}
                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-200/80">
                      <p className="text-[9px] font-extrabold uppercase text-slate-500">Volumen</p>
                      <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                        {fmtInt(monthOverMonthStats.current.revisadas)}
                      </p>
                      <p className={`text-[10px] font-bold font-mono mt-0.5 ${
                        monthOverMonthStats.hasPrev
                          ? (monthOverMonthStats.deltaVolumen >= 0 ? 'text-emerald-600' : 'text-slate-500')
                          : 'text-slate-400'
                      }`}>
                        {monthOverMonthStats.hasPrev
                          ? (monthOverMonthStats.deltaVolumen > 0 ? `+${fmtInt(monthOverMonthStats.deltaVolumen)} pz` : `${fmtInt(monthOverMonthStats.deltaVolumen)} pz`)
                          : 'Base inicial pz'}
                      </p>
                    </div>

                    {/* 1ª Calidad */}
                    <div className="bg-emerald-50/60 rounded-xl p-2 border border-emerald-200/80">
                      <p className="text-[9px] font-extrabold uppercase text-emerald-700">1ª Calidad</p>
                      <p className="text-sm font-black text-emerald-800 font-mono mt-0.5">
                        {monthOverMonthStats.current.pctBuenas}%
                      </p>
                      <p className={`text-[10px] font-bold font-mono mt-0.5 flex items-center gap-0.5 ${
                        monthOverMonthStats.hasPrev
                          ? (monthOverMonthStats.deltaBuenas >= 0 ? 'text-emerald-700' : 'text-rose-600')
                          : 'text-emerald-600'
                      }`}>
                        {monthOverMonthStats.hasPrev ? (
                          <>
                            {monthOverMonthStats.deltaBuenas >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>{monthOverMonthStats.deltaBuenas > 0 ? `+${monthOverMonthStats.deltaBuenas}` : monthOverMonthStats.deltaBuenas} pp</span>
                          </>
                        ) : (
                          <span>Base inicial</span>
                        )}
                      </p>
                    </div>

                    {/* Segundas */}
                    <div className="bg-amber-50/60 rounded-xl p-2 border border-amber-200/80">
                      <p className="text-[9px] font-extrabold uppercase text-amber-700">Segundas</p>
                      <p className="text-sm font-black text-amber-800 font-mono mt-0.5">
                        {monthOverMonthStats.current.pctSegundas}%
                      </p>
                      <p className={`text-[10px] font-bold font-mono mt-0.5 flex items-center gap-0.5 ${
                        monthOverMonthStats.hasPrev
                          ? (monthOverMonthStats.deltaSegundas <= 0 ? 'text-emerald-700' : 'text-rose-600')
                          : 'text-amber-700'
                      }`}>
                        {monthOverMonthStats.hasPrev ? (
                          <>
                            {monthOverMonthStats.deltaSegundas <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            <span>{monthOverMonthStats.deltaSegundas > 0 ? `+${monthOverMonthStats.deltaSegundas}` : monthOverMonthStats.deltaSegundas} pp</span>
                          </>
                        ) : (
                          <span>Base inicial</span>
                        )}
                      </p>
                    </div>

                    {/* Arreglos */}
                    <div className="bg-sky-50/60 rounded-xl p-2 border border-sky-200/80">
                      <p className="text-[9px] font-extrabold uppercase text-sky-700">Arreglos</p>
                      <p className="text-sm font-black text-sky-800 font-mono mt-0.5">
                        {monthOverMonthStats.current.pctArreglos}%
                      </p>
                      <p className={`text-[10px] font-bold font-mono mt-0.5 flex items-center gap-0.5 ${
                        monthOverMonthStats.hasPrev
                          ? (monthOverMonthStats.deltaArreglos <= 0 ? 'text-emerald-700' : 'text-rose-600')
                          : 'text-sky-700'
                      }`}>
                        {monthOverMonthStats.hasPrev ? (
                          <>
                            {monthOverMonthStats.deltaArreglos <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            <span>{monthOverMonthStats.deltaArreglos > 0 ? `+${monthOverMonthStats.deltaArreglos}` : monthOverMonthStats.deltaArreglos} pp</span>
                          </>
                        ) : (
                          <span>Base inicial</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Gráfica Comparativa de Barras Lado a Lado Mes Anterior vs Mes Actual */}
                <div className="h-[215px] w-full pt-1">
                  {comparativeRatesMoM.length > 0 && monthOverMonthStats?.current ? (
                    <ResponsiveContainer width="100%" height={215}>
                      <BarChart
                        data={comparativeRatesMoM}
                        margin={{ top: 20, right: 15, left: -15, bottom: 5 }}
                        barGap={5}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="indicador"
                          tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                          stroke="#cbd5e1"
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          stroke="#cbd5e1"
                          tickLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            if (!d) return null;
                            const prevMonthName = monthOverMonthStats.prev?.monthName || 'Base';
                            const currMonthName = monthOverMonthStats.current.monthName;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[180px]">
                                <p className="font-bold border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                                  <span>{d.indicador}</span>
                                  {monthOverMonthStats.hasPrev && (
                                    <span className={`font-mono font-bold ${d.isFavorable ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      {d.delta > 0 ? `+${d.delta}` : d.delta} pp
                                    </span>
                                  )}
                                </p>
                                <div className="space-y-1 font-mono text-[11px]">
                                  {monthOverMonthStats.hasPrev && (
                                    <div className="flex justify-between text-slate-300">
                                      <span>{prevMonthName}:</span>
                                      <strong style={{ color: d.prevColor }}>{d.prevVal}%</strong>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-white">
                                    <span>{currMonthName}:</span>
                                    <strong style={{ color: d.currColor }}>{d.currentVal}%</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        {monthOverMonthStats.hasPrev && (
                          <Bar
                            dataKey={monthOverMonthStats.prev.monthName}
                            name={monthOverMonthStats.prev.monthName}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={38}
                            isAnimationActive={false}
                          >
                            {comparativeRatesMoM.map((entry, idx) => (
                              <Cell key={`prev-${idx}`} fill={entry.prevColor} />
                            ))}
                            <LabelList
                              dataKey={monthOverMonthStats.prev.monthName}
                              position="top"
                              formatter={(v: any) => `${v}%`}
                              style={{ fill: '#64748b', fontSize: '10px', fontWeight: 800 }}
                            />
                          </Bar>
                        )}
                        <Bar
                          dataKey={monthOverMonthStats.current.monthName}
                          name={monthOverMonthStats.current.monthName}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={38}
                          isAnimationActive={false}
                        >
                          {comparativeRatesMoM.map((entry, idx) => (
                            <Cell key={`curr-${idx}`} fill={entry.currColor} />
                          ))}
                          <LabelList
                            dataKey={monthOverMonthStats.current.monthName}
                            position="top"
                            formatter={(v: any) => `${v}%`}
                            style={{ fill: '#0f172a', fontSize: '10px', fontWeight: 800 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 italic">
                      <Calendar className="w-6 h-6 text-slate-300 mb-1" />
                      <span>No hay datos en {MONTH_NAMES[selectedMonth]} {selectedYear}.</span>
                    </div>
                  )}
                </div>

                {/* Leyenda Visual de Colores y Periodos */}
                {monthOverMonthStats?.current && (
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-1.5 pb-0.5 text-[11px] font-bold text-slate-600">
                    {monthOverMonthStats.hasPrev && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-slate-300 border border-slate-400 inline-block" />
                        <span>{monthOverMonthStats.prev.monthName} (Mes Anterior - Tono Pastel)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
                      <span>{monthOverMonthStats.current.monthName} (Mes Activo - Color Temático)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie informativo */}
              <div className="mt-3 bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-center justify-between">
                <span>
                  {monthOverMonthStats?.current ? (
                    <>
                      💡 Calculado sobre <strong>{fmtInt(monthOverMonthStats.current.revisadas)} piezas</strong> en {monthOverMonthStats.current.monthName} {monthOverMonthStats.current.year}.
                    </>
                  ) : (
                    <span>💡 Sin registros en el periodo actual.</span>
                  )}
                </span>
                {monthOverMonthStats?.hasPrev && (
                  <span className="font-mono font-bold text-slate-500">
                    Base {monthOverMonthStats.prev?.monthName}: {fmtInt(monthOverMonthStats.prev?.revisadas || 0)} pz
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfica 1: Comparativa Primeras vs Segundas (2 Columnas) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
                  <GitCompare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Comparativa de Calidad: Primeras vs Segundas
                    </h3>
                    {disenoFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold">
                        <span>Diseño: {disenoFilter}</span>
                        <button
                          type="button"
                          onClick={() => setDisenoFilter('all')}
                          className="hover:text-red-600 p-0.5 cursor-pointer"
                          title="Quitar filtro de diseño"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {hiddenTopDesigns.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                        <EyeOff className="w-3 h-3 text-amber-600" />
                        <span>{hiddenTopDesigns.length} oculto{hiddenTopDesigns.length === 1 ? '' : 's'}</span>
                      </span>
                    )}
                    {tecnicaFilter !== 'all' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        tecnicaFilter === 'REACTIVO' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tecnicaFilter}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Prendas conformes de primera vs segundas totales acumuladas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setComparativaGrouping('dia')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    comparativaGrouping === 'dia' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Día a Día
                </button>
                <button
                  type="button"
                  onClick={() => setComparativaGrouping('diseno')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    comparativaGrouping === 'diseno' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top Diseños
                </button>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={comparativaData}
                  margin={{ top: 15, right: 15, left: -15, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    angle={comparativaGrouping === 'diseno' ? -25 : 0}
                    textAnchor={comparativaGrouping === 'diseno' ? 'end' : 'middle'}
                    interval={0}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    tickFormatter={(v) => fmtInt(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#10b981' }}
                    stroke="#10b981"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[200px]">
                          <p className="font-black text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                            <span>{d.label}</span>
                            {d.tecnica && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                d.tecnica === 'REACTIVO' ? 'bg-purple-900 text-purple-200' : 'bg-amber-900 text-amber-200'
                              }`}>
                                {d.tecnica}
                              </span>
                            )}
                          </p>
                          <div className="space-y-1 font-mono">
                            <div className="flex justify-between text-slate-300">
                              <span>Total Revisadas:</span>
                              <strong className="text-white">{fmtInt(d.estampadas)}</strong>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>Primeras (Buenas):</span>
                              <strong>{fmtInt(d.primeras)} ({d.pctPrimeras}%)</strong>
                            </div>
                            <div className="flex justify-between text-rose-400">
                              <span>Segundas (Fallas):</span>
                              <strong>{fmtInt(d.segundas)} ({((d.segundas / (d.estampadas || 1)) * 100).toFixed(1)}%)</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '10px' }}
                    formatter={(value) => <span className="text-xs text-slate-600 font-bold">{value}</span>}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="primeras"
                    name="Primeras (Buenas)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="segundas"
                    name="Segundas (Fallas)"
                    fill="#f43f5e"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pctPrimeras"
                    name="% Eficiencia Primeras"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#059669' }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfica 2: Volumen por Técnica (Gráfico de Pastel / Donut Ejecutivo) */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
                    <LucidePieChart className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">
                      Volumen por Técnica
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      Reactivo vs Pigmento
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                  {fmtInt(totals.revisada)} pz
                </span>
              </div>

              {/* Donut Chart Recharts */}
              <div className="h-[185px] w-full relative">
                <ResponsiveContainer width="100%" height={185}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={tecnicaPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={74}
                      paddingAngle={4}
                      isAnimationActive={false}
                    >
                      {tecnicaPieData.map((entry, index) => (
                        <Cell
                          key={`tecnica-pie-cell-${index}`}
                          fill={entry.color}
                          className="cursor-pointer hover:opacity-85 transition-opacity"
                          onClick={() => setTecnicaFilter(prev => prev === entry.name.toUpperCase() ? 'all' : (entry.name.toUpperCase() as any))}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[170px] pointer-events-none">
                            <p className="font-bold border-b border-slate-700 pb-1 mb-1 flex items-center justify-between">
                              <span>{d.name}</span>
                              <span className="font-mono text-purple-300 font-black">{d.pct.toFixed(1)}%</span>
                            </p>
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex justify-between text-slate-300">
                                <span>Revisadas:</span>
                                <strong>{fmtInt(d.value)} pz</strong>
                              </div>
                              <div className="flex justify-between text-emerald-400">
                                <span>Buenas:</span>
                                <strong>{fmtInt(d.buenas)} pz</strong>
                              </div>
                              <div className="flex justify-between text-rose-400">
                                <span>Segundas:</span>
                                <strong>{fmtInt(d.segundas)} pz ({((d.segundas / (d.value || 1)) * 100).toFixed(1)}%)</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centro del Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800 font-mono tracking-tight leading-none">
                    {fmtInt(totals.revisada)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Total pz
                  </span>
                </div>
              </div>

              {/* Desglose Interactivo de Cada Técnica con % Grandes */}
              <div className="space-y-2 mt-1">
                {/* Fila Reactivo */}
                <div
                  onClick={() => setTecnicaFilter(prev => prev === 'REACTIVO' ? 'all' : 'REACTIVO')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    tecnicaFilter === 'REACTIVO'
                      ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-200'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                  }`}
                  title="Clic para filtrar por Reactivo"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Reactivo</span>
                        {tecnicaFilter === 'REACTIVO' && (
                          <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">Filtrado</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {fmtInt(totals.reactivoRevisada)} pz · {fmtInt(totals.reactivoSegundas)} seg ({((totals.reactivoSegundas / (totals.reactivoRevisada || 1)) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg font-mono shrink-0 shadow-2xs">
                    {tecnicaPieData[0].pct.toFixed(1)}%
                  </span>
                </div>

                {/* Fila Pigmento */}
                <div
                  onClick={() => setTecnicaFilter(prev => prev === 'PIGMENTO' ? 'all' : 'PIGMENTO')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    tecnicaFilter === 'PIGMENTO'
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                  }`}
                  title="Clic para filtrar por Pigmento"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Pigmento</span>
                        {tecnicaFilter === 'PIGMENTO' && (
                          <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">Filtrado</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {fmtInt(totals.pigmentoRevisada)} pz · {fmtInt(totals.pigmentoSegundas)} seg ({((totals.pigmentoSegundas / (totals.pigmentoRevisada || 1)) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg font-mono shrink-0 shadow-2xs">
                    {tecnicaPieData[1].pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {tecnicaFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setTecnicaFilter('all')}
                className="mt-2 w-full py-1 text-center text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer border border-purple-200/60"
              >
                Restablecer filtro (Ver ambas técnicas)
              </button>
            ) : (
              <p className="text-[10px] text-slate-400 font-medium text-center mt-2">
                💡 Clic en una técnica para filtrar el dashboard
              </p>
            )}
          </div>
        </div>

          {/* ─────────────────────────────────────────────────────────
              TOP DISEÑOS DINÁMICO (CALIDAD / SEGUNDAS)
              ESTILO IDÉNTICO A PRODUCCIÓN
          ─────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header del Card con Controles Rápidos */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">
                      {topDesignSortOrder === 'desc'
                        ? (topDesignMetric === 'segundas' ? 'Top diseños con más segundas' :
                           topDesignMetric === 'estampado' ? 'Top diseños con más fallas de estampado' :
                           topDesignMetric === 'revisadas' ? 'Top diseños más producidos' : 'Top diseños con mayor % de segundas')
                        : (topDesignMetric === 'segundas' ? 'Diseños con menos segundas' :
                           topDesignMetric === 'estampado' ? 'Diseños con menos fallas' :
                           topDesignMetric === 'revisadas' ? 'Diseños menos producidos' : 'Diseños con menor % de segundas')}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.label} · {topDesignLimit > 0 ? `hasta ${topDesignLimit} diseños` : 'todos'} ({activeTopDesignsList.length} visible{activeTopDesignsList.length === 1 ? '' : 's'}{hiddenTopDesigns.length > 0 ? ` · ${hiddenTopDesigns.length} oculto${hiddenTopDesigns.length === 1 ? '' : 's'}` : ''})
                    </p>
                  </div>
                </div>

                {/* Botones de acción en la cabecera */}
                <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                  {/* Selector de Métrica */}
                  <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                    {TOP_DESIGN_METRICS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTopDesignMetric(m.id as any)}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          topDesignMetric === m.id
                            ? 'bg-white text-rose-700 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Selector de Top N */}
                  <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                    {[5, 10, 20, 0].map(limit => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => setTopDesignLimit(limit)}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          topDesignLimit === limit
                            ? 'bg-white text-blue-700 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {limit === 0 ? 'Todos' : `Top ${limit}`}
                      </button>
                    ))}
                  </div>

                  {/* Invertir Orden (Desc/Asc) */}
                  <button
                    type="button"
                    onClick={() => setTopDesignSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="p-1.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    title={topDesignSortOrder === 'desc' ? 'Orden actual: Mayor a menor. Clic para invertir' : 'Orden actual: Menor a mayor. Clic para invertir'}
                  >
                    {topDesignSortOrder === 'desc' ? (
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpNarrowWide className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>

                  {/* Botón Gestión / Ocultar Diseños */}
                  <button
                    type="button"
                    onClick={() => setIsDesignManagerOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      hiddenTopDesigns.length > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100'
                    }`}
                    title="Configurar qué diseños ocultar o mostrar"
                  >
                    {hiddenTopDesigns.length > 0 ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>Ocultar</span>
                    {hiddenTopDesigns.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                        {hiddenTopDesigns.length}
                      </span>
                    )}
                  </button>

                  {/* Descarga Gráfica a Imagen PNG */}
                  <button
                    type="button"
                    onClick={exportTopDesignsImage}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all cursor-pointer shadow-2xs"
                    title="Descargar este gráfico en imagen PNG de alta resolución"
                  >
                    <LucideImage className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">PNG</span>
                  </button>

                  {/* Exportar Ranking a PDF */}
                  <button
                    type="button"
                    onClick={exportTopDesignsPDF}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all cursor-pointer shadow-2xs"
                    title="Exportar reporte de este ranking en PDF para planta"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </div>
              </div>

              {/* Sub-barra: Búsqueda rápida predictiva, Filtro de Proceso, Filtro de Riesgo y Filtro de Línea de Tela */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Buscador predictivo de diseños */}
                  <div className="relative flex-1 min-w-[170px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      type="text"
                      value={topDesignSearch}
                      onChange={e => {
                        setTopDesignSearch(e.target.value);
                        setIsPredictiveSearchOpen(true);
                      }}
                      onFocus={() => setIsPredictiveSearchOpen(true)}
                      onBlur={() => setTimeout(() => setIsPredictiveSearchOpen(false), 250)}
                      placeholder="Buscar diseño predictivo..."
                      className="w-full pl-8 pr-7 py-1 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-400 focus:bg-white focus:outline-hidden transition-all"
                    />
                    {topDesignSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setTopDesignSearch('');
                          setIsPredictiveSearchOpen(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {/* Desplegable flotante de resultados predictivos */}
                    {isPredictiveSearchOpen && predictiveSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-50 max-h-56 overflow-y-auto">
                        <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Sugerencias de Diseño ({predictiveSuggestions.length})
                        </div>
                        {predictiveSuggestions.map(sug => (
                          <div
                            key={sug.name}
                            onMouseDown={() => {
                              setTopDesignSearch(sug.name);
                              setDisenoFilter(sug.name);
                              setIsPredictiveSearchOpen(false);
                            }}
                            className="px-3 py-1.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-800 truncate">{sug.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                sug.process === 'REACTIVO' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {sug.process}
                              </span>
                              {sug.referencia && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-bold">
                                  {sug.referencia}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-black text-rose-600 shrink-0 ml-2">
                              {sug.pctSegundas}% seg
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Filtro de proceso (Reactivo / Pigmento) */}
                  <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold shrink-0">
                    {(['all', 'REACTIVO', 'PIGMENTO'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setTopDesignProcessFilter(p);
                          setTecnicaFilter(p);
                        }}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          topDesignProcessFilter === p
                            ? 'bg-white text-blue-700 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {p === 'all' ? 'Todos' : p === 'REACTIVO' ? 'Reactivo' : 'Pigmento'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtros Rápidos: Mayor Impacto de Error & Líneas de Producto */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  {/* Mayor Impacto de Error */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="font-black text-slate-400 uppercase tracking-wider mr-0.5">Impacto:</span>
                    <button
                      type="button"
                      onClick={() => setTopDesignRiskFilter('all')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        topDesignRiskFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopDesignRiskFilter('critical')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        topDesignRiskFilter === 'critical'
                          ? 'bg-rose-600 text-white shadow-2xs shadow-rose-600/30'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                      title="Diseños con segundas iguales o mayores al 8%"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      Críticos (≥8%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopDesignRiskFilter('warning')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        topDesignRiskFilter === 'warning'
                          ? 'bg-amber-500 text-white shadow-2xs shadow-amber-500/30'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title="Diseños en zona preventiva (4% a 8%)"
                    >
                      Alerta (4-8%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopDesignRiskFilter('normal')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        topDesignRiskFilter === 'normal'
                          ? 'bg-emerald-600 text-white shadow-2xs shadow-emerald-600/30'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title="Diseños con segundas menores a 4%"
                    >
                      Conforme (&lt;4%)
                    </button>
                  </div>

                  {/* Línea de Producto (Bases de Tela) */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="font-black text-slate-400 uppercase tracking-wider mr-0.5">Tela:</span>
                    <button
                      type="button"
                      onClick={() => setTopDesignFabricFilter('all')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        topDesignFabricFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todas
                    </button>
                    {availableReferences.slice(0, 4).map(ref => (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => setTopDesignFabricFilter(ref)}
                        className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                          topDesignFabricFilter.toUpperCase() === ref.toUpperCase()
                            ? 'bg-blue-700 text-white shadow-2xs'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chips de diseños actualmente ocultos */}
              {hiddenTopDesigns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs mb-3">
                  <div className="flex items-center gap-1 text-amber-800 font-bold shrink-0 text-[11px]">
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ocultos ({hiddenTopDesigns.length}):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 max-h-16 overflow-y-auto no-scrollbar">
                    {hiddenTopDesigns.map(name => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-900 text-[10px] font-bold shadow-2xs"
                      >
                        <span className="truncate max-w-[130px]">{name}</span>
                        <button
                          type="button"
                          onClick={() => toggleHideDesign(name)}
                          title={`Mostrar "${name}"`}
                          className="text-amber-500 hover:text-red-600 cursor-pointer p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={showAllDesigns}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline ml-auto shrink-0 cursor-pointer"
                  >
                    Mostrar todos
                  </button>
                </div>
              )}
            </div>

            {/* Gráfico o Estado Vacío */}
            {activeTopDesignsList.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 my-2">
                <EyeOff className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No hay diseños para mostrar</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {topDesignSearch ? 'Ningún diseño coincide con la búsqueda' : 'Todos los diseños seleccionados están ocultos'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {hiddenTopDesigns.length > 0 && (
                    <button
                      type="button"
                      onClick={showAllDesigns}
                      className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Mostrar todos los diseños ({hiddenTopDesigns.length} ocultos)
                    </button>
                  )}
                  {topDesignSearch && (
                    <button
                      type="button"
                      onClick={() => setTopDesignSearch('')}
                      className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full overflow-y-auto no-scrollbar" style={{ maxHeight: activeTopDesignsList.length > 10 ? 460 : undefined }}>
                <div id="top-designs-chart-container" style={{ height: Math.max(220, activeTopDesignsList.length * 36) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeTopDesignsList} layout="vertical" margin={{ top: 0, right: 65, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={130}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const name = payload.value;
                          const isFiltered = disenoFilter === name;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={-5}
                                y={3}
                                textAnchor="end"
                                fill={isFiltered ? '#2563eb' : '#334155'}
                                fontWeight={isFiltered ? 900 : 800}
                                fontSize={9}
                                className="cursor-pointer hover:fill-blue-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisenoFilter(prev => prev === name ? 'all' : name);
                                }}
                              >
                                {isFiltered ? `▶ ${name}` : name}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          const isReactivo = item.process === 'REACTIVO';
                          const unit = TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.unit || 'pz';

                          return (
                            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xl text-xs space-y-1.5 min-w-[220px] pointer-events-none">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                <p className="font-black text-slate-800 uppercase tracking-wide truncate max-w-[150px]" title={item.name}>
                                  {item.name}
                                </p>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                                  isReactivo ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {item.process || 'General'}
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between pt-0.5">
                                <span className="text-slate-500 font-semibold">{TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.label}:</span>
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  {topDesignMetric === 'pctSegundas' ? `${item.value}%` : fmtInt(item.value)} <span className="text-[10px] text-slate-500">{unit}</span>
                                </span>
                              </div>
                              <div className="space-y-0.5 font-mono text-[11px] pt-1 border-t border-slate-100">
                                <div className="flex justify-between text-slate-600">
                                  <span>Total Estampadas:</span>
                                  <strong>{fmtInt(item.totalRevisadas)}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-700">
                                  <span>Buenas (1ª):</span>
                                  <strong>{fmtInt(item.buenas)}</strong>
                                </div>
                                <div className="flex justify-between text-rose-700">
                                  <span>Segundas:</span>
                                  <strong>{fmtInt(item.totalSegundas)} ({item.pctSegundas}%)</strong>
                                </div>
                                <div className="flex justify-between text-amber-800">
                                  <span>Def. Estampado:</span>
                                  <strong>{fmtInt(item.defectosEstampado)}</strong>
                                </div>
                              </div>
                              {item.topDefecto && (
                                <div className="pt-1 border-t border-slate-100 text-[10px] text-rose-700 font-semibold">
                                  Falla principal: <strong>{item.topDefecto}</strong> ({item.topDefectoCant} pz)
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-0.5 text-[10px] text-slate-500 font-medium">
                                <div className="flex items-center gap-1 text-amber-700">
                                  <EyeOff className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Clic en la barra: <strong>Ocultar de todas las gráficas</strong></span>
                                </div>
                                <div className="text-blue-600">
                                  <span>🔍 Clic en el nombre: <strong>Ver día a día en la comparativa</strong></span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[0, 6, 6, 0]}
                        barSize={16}
                        isAnimationActive={false}
                        label={{
                          position: 'right',
                          fontSize: 9,
                          fill: '#475569',
                          fontWeight: 700,
                          formatter: (v: any) => topDesignMetric === 'pctSegundas' ? `${v}%` : fmtInt(Number(v))
                        }}
                      >
                        {activeTopDesignsList.map((d, i) => (
                          <Cell
                            key={d.name || i}
                            fill={DESIGN_COLORS[i % DESIGN_COLORS.length]}
                            className="cursor-pointer hover:opacity-85 transition-opacity"
                            onClick={() => toggleHideDesign(d.name)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
              <span>💡 Haz clic en una barra para ocultar/mostrar ese diseño de las gráficas · Haz clic en el nombre para filtrar su comparativa día a día</span>
              {hiddenTopDesigns.length > 0 && (
                <button
                  type="button"
                  onClick={showAllDesigns}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Restablecer todos los ocultos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: DIAGNÓSTICO DE FALLAS POR DISEÑO (REFERENCIA EN TALLER)
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'fallas_ref' && (
        <div className="space-y-4">
          {/* Barra de Controles y Herramientas de la Vista de Fallas por Diseño */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className={`w-4 h-4 ${PROCESS_CONFIG[fallasProcess].headerIconColor}`} />
                  Diagnóstico de Fallas por Diseño (Referencia) — <span className={PROCESS_CONFIG[fallasProcess].cardPredominanteText}>{PROCESS_CONFIG[fallasProcess].badgeLabel}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Identifica qué defecto específico ({PROCESS_CONFIG[fallasProcess].defectsSummary}) predomina en cada diseño textil.
                </p>
              </div>

              {/* Selector de Modo de Visualización */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFallasViewMode('cards')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Tarjetas ({filteredDefectsByDesign.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFallasViewMode('chart')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'chart' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Gráfico Comparativo
                </button>
                <button
                  type="button"
                  onClick={() => setFallasViewMode('matrix')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'matrix' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Matriz de Defectos ({PROCESS_DEFECT_SPECS[fallasProcess].length})
                </button>
              </div>
            </div>

            {/* Selector de Proceso: Estampado, Tintorería, Tejeduría, Costura, Consolidado */}
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/80 mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase px-2 shrink-0 tracking-wider">
                Proceso:
              </span>
              <button
                type="button"
                onClick={() => setFallasProcess('estampado')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fallasProcess === 'estampado'
                    ? 'bg-rose-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-white/70'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Estampado
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  fallasProcess === 'estampado' ? 'bg-rose-700 text-rose-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {fmtInt(globalProcessTotals.estampado)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFallasProcess('tintoreria')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fallasProcess === 'tintoreria'
                    ? 'bg-cyan-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-cyan-800 hover:bg-white/70'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                Tintorería
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  fallasProcess === 'tintoreria' ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {fmtInt(globalProcessTotals.tintoreria)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFallasProcess('tejeduria')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fallasProcess === 'tejeduria'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-emerald-800 hover:bg-white/70'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tejeduría
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  fallasProcess === 'tejeduria' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {fmtInt(globalProcessTotals.tejeduria)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFallasProcess('costura')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fallasProcess === 'costura'
                    ? 'bg-purple-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-purple-800 hover:bg-white/70'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                Costura
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  fallasProcess === 'costura' ? 'bg-purple-700 text-purple-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {fmtInt(globalProcessTotals.costura)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFallasProcess('todos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fallasProcess === 'todos'
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Consolidado ({fmtInt(globalProcessTotals.total)})
              </button>
            </div>

            {/* Filtros locales de la vista: Búsqueda, Orden y Chips rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={`Buscar diseño en ${PROCESS_CONFIG[fallasProcess].label}...`}
                    value={fallasDesignSearch}
                    onChange={(e) => setFallasDesignSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-400 text-slate-800"
                  />
                  {fallasDesignSearch && (
                    <button
                      type="button"
                      onClick={() => setFallasDesignSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Selector de Orden */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Ordenar:</span>
                  <select
                    value={fallasSortBy}
                    onChange={(e) => setFallasSortBy(e.target.value as any)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="fallas">Mayor Fallas {PROCESS_CONFIG[fallasProcess].badgeLabel}</option>
                    <option value="revisadas">Mayor Cantidad Revisada</option>
                    <option value="pct">Mayor % de Falla {PROCESS_CONFIG[fallasProcess].badgeLabel}</option>
                    <option value="nombre">Nombre (A - Z)</option>
                  </select>
                </div>
              </div>

              {/* Chips de acceso directo a los Diseños con más defectos en este proceso */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Diseño:</span>
                <button
                  type="button"
                  onClick={() => setFallasDesignSearch('')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    !fallasDesignSearch ? 'bg-slate-900 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                {defectsByDesign
                  .filter(d => d.activeTotal > 0)
                  .sort((a, b) => b.activeTotal - a.activeTotal)
                  .slice(0, 7)
                  .map(d => (
                    <button
                      key={d.diseno}
                      type="button"
                      onClick={() => setFallasDesignSearch(d.diseno)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                        fallasDesignSearch.toUpperCase() === d.diseno
                          ? 'bg-slate-900 text-white font-black shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                      }`}
                    >
                      {d.diseno} ({d.activeTotal})
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* MODO 1: TARJETAS DETALLADAS POR CADA DISEÑO */}
          {fallasViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDefectsByDesign.map((d) => {
                const hasDefects = d.activeTotal > 0;
                const procCfg = PROCESS_CONFIG[fallasProcess];
                return (
                  <div
                    key={d.diseno}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3.5 transition-all ${
                      hasDefects ? `border-slate-200/90 ${procCfg.borderHoverClass}` : 'border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/20'
                    }`}
                  >
                    <div>
                      {/* Cabecera del Diseño */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                        <div>
                          <h4 className="text-base font-black text-slate-900 tracking-tight">
                            {d.diseno}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-extrabold px-2 py-0.2 rounded-md ${
                              d.tecnica === 'REACTIVO'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {d.tecnica}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              Ref {d.referencia}
                            </span>
                            {d.dimensiones && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {d.dimensiones}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-slate-900 font-mono">{fmtInt(d.totalRevisadas)}</span>
                          <span className="block text-[9px] text-slate-400 uppercase">Revisadas</span>
                          <span className="block text-[9px] font-bold text-emerald-700 font-mono">
                            {fmtPct(d.pctBuenas / 100, 1)} Buenas
                          </span>
                        </div>
                      </div>

                      {/* CAJA DE FALLA PREDOMINANTE EN ESTE PROCESO */}
                      {hasDefects ? (
                        <div className={`${procCfg.cardPredominanteBg} border ${procCfg.cardPredominanteBorder} p-3 rounded-xl mb-3 shadow-2xs`}>
                          <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-wider ${procCfg.cardPredominanteText}`}>
                            <span>Falla Predominante ({procCfg.badgeLabel}):</span>
                            <span className="font-mono">{d.activeTopCant} pz ({d.activeTopPct}%)</span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <strong className="text-base font-black text-slate-950">
                              {d.activeTopName}
                            </strong>
                            <span className={`text-[11px] font-bold ${procCfg.cardPredominanteText} font-mono`}>
                              {d.activeTotal} {procCfg.unitLabel} ({d.activePct}%)
                            </span>
                          </div>
                          {/* Barra visual de peso de la falla */}
                          <div className="w-full bg-slate-200/70 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className={`${procCfg.barColor} h-full rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, d.activeTopPct)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50/90 border border-emerald-200 p-3 rounded-xl mb-3 text-center">
                          <span className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {procCfg.emptyText}
                          </span>
                          <p className="text-[10px] text-emerald-600 mt-0.5">Todas las prendas salieron conformes de este proceso.</p>
                        </div>
                      )}

                      {/* DESGLOSE DETALLADO DE DEFECTOS DEL PROCESO */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Desglose de Defectos ({d.activeTotal} pz):
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                          {PROCESS_DEFECT_SPECS[fallasProcess].map(s => {
                            const cant = (d as any)[s.key] || 0;
                            const pctDef = d.activeTotal > 0 ? ((cant / d.activeTotal) * 100).toFixed(0) : '0';
                            return (
                              <div
                                key={s.name}
                                className={`flex justify-between p-1.5 rounded-lg border transition-all ${
                                  cant > 0
                                    ? `${s.bgClass} border-slate-200/90 text-slate-900 shadow-2xs`
                                    : 'bg-slate-50/40 border-slate-100 text-slate-400'
                                }`}
                              >
                                <span className="text-slate-600 truncate max-w-[95px]" title={s.name}>{s.shortName}:</span>
                                <strong className={cant > 0 ? `${s.textClass} font-black` : 'text-slate-300'}>
                                  {cant} {cant > 0 && d.activeTotal > 0 ? `(${pctDef}%)` : ''}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Pie de la tarjeta: Confección y Enlace rápido a Planilla */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Confecc: <strong className="text-slate-700">{d.arreLaterales + d.arreCabeceras}</strong> pz</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm(d.diseno);
                          setSubView('planilla');
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        Ver en Planilla &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 2: GRÁFICO COMPARATIVO DE DEFECTOS POR DISEÑO */}
          {fallasViewMode === 'chart' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-9 h-9 rounded-xl ${PROCESS_CONFIG[fallasProcess].cardPredominanteBg} ${PROCESS_CONFIG[fallasProcess].cardPredominanteText} flex items-center justify-center shrink-0 border ${PROCESS_CONFIG[fallasProcess].cardPredominanteBorder}`}>
                  <BarChart3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Comparativa de Defectos de {PROCESS_CONFIG[fallasProcess].label} en Top Diseños (Referencias)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Barras apiladas mostrando qué porcentaje y cantidad de cada defecto compone las fallas de cada diseño.
                  </p>
                </div>
              </div>

              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart
                    data={fallasPorDisenoChartData}
                    margin={{ top: 15, right: 15, left: -15, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="diseno"
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                      stroke="#cbd5e1"
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      tickFormatter={(v) => fmtInt(v)}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[210px]">
                            <p className="font-black text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                              <span>{d.diseno}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                d.tecnica === 'REACTIVO' ? 'bg-purple-900 text-purple-200' : 'bg-amber-900 text-amber-200'
                              }`}>
                                {d.tecnica}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-300 font-mono font-bold mb-2">
                              Total Fallas {PROCESS_CONFIG[fallasProcess].label}: {d.totalFallas} piezas
                            </p>
                            <div className="space-y-1 font-mono text-[11px]">
                              {PROCESS_DEFECT_SPECS[fallasProcess].map(s => {
                                const val = d[s.name] || 0;
                                if (val <= 0) return null;
                                return (
                                  <div key={s.name} className="flex justify-between" style={{ color: s.color }}>
                                    <span>• {s.name}:</span>
                                    <strong>{val}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ paddingBottom: '10px' }}
                      formatter={(val) => <span className="text-xs font-bold text-slate-600">{val}</span>}
                    />
                    {PROCESS_DEFECT_SPECS[fallasProcess].map(s => (
                      <Bar
                        key={s.name}
                        dataKey={s.name}
                        fill={s.color}
                        stackId="a"
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* MODO 3: MATRIZ COMPLETA DE DEFECTOS POR DISEÑO */}
          {fallasViewMode === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Diseño</th>
                      <th className="py-2.5 px-2">Técnica</th>
                      <th className="py-2.5 px-2">Ref</th>
                      <th className="py-2.5 px-2 text-right">Revisadas</th>
                      <th className="py-2.5 px-2 text-right">Primeras</th>
                      <th className="py-2.5 px-3">Falla Principal</th>
                      {PROCESS_DEFECT_SPECS[fallasProcess].map(s => (
                        <th key={s.name} className={`py-2.5 px-2 text-right ${s.textClass} ${s.bgClass}`}>
                          {s.shortName}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right bg-slate-200 text-slate-900 font-black">
                        Tot. {PROCESS_CONFIG[fallasProcess].label}
                      </th>
                      <th className="py-2.5 px-2 text-center">% Falla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {filteredDefectsByDesign.map((d) => (
                      <tr key={d.diseno} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold font-sans text-slate-900">
                          {d.diseno}
                        </td>
                        <td className="py-2.5 px-2 font-sans">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                            d.tecnica === 'REACTIVO' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-800'
                          }`}>
                            {d.tecnica}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">{d.referencia}</td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900">{fmtInt(d.totalRevisadas)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700">{fmtInt(d.totalBuenas)}</td>
                        <td className="py-2.5 px-3 font-sans">
                          {d.activeTotal > 0 ? (
                            <span
                              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border"
                              style={{
                                borderColor: d.activeTopColor,
                                color: d.activeTopColor,
                                backgroundColor: '#f8fafc'
                              }}
                            >
                              {d.activeTopName} ({d.activeTopCant})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700">Sin fallas</span>
                          )}
                        </td>
                        {PROCESS_DEFECT_SPECS[fallasProcess].map(s => {
                          const val = (d as any)[s.key] || 0;
                          return (
                            <td
                              key={s.name}
                              className={`py-2.5 px-2 text-right ${val > 0 ? `font-bold ${s.textClass} ${s.bgClass}` : 'text-slate-300'}`}
                            >
                              {val}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 bg-slate-100/70">{d.activeTotal}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            d.activePct > 3 ? 'bg-rose-100 text-rose-800' : d.activePct > 1.5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {d.activePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECCIÓN SUPLEMENTARIA COLAPSABLE: RESUMEN POR TELA BASE (C280T vs ME1002 vs ML1002) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black text-slate-700">
                  Resumen Complementario por Código de Tela Base (C280T, ME1002, ML1002)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTelaComparison(prev => !prev)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {showTelaComparison ? 'Ocultar Resumen de Telas' : 'Mostrar Resumen de Telas'}
              </button>
            </div>

            {showTelaComparison && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {defectsByReference.map(refData => (
                    <div key={refData.referencia} className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-mono font-black text-sm text-slate-900">{refData.referencia}</span>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">{refData.tecnica}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Estampadas: <strong className="text-slate-800">{fmtInt(refData.totalRevisadas)}</strong></p>
                      <p className="text-[11px] text-rose-700 font-bold mt-1">Falla Principal: {refData.topDefectoEstampado} ({refData.topDefectoEstampadoCant} pz)</p>
                    </div>
                  ))}
                </div>

                <div className="h-[250px] w-full bg-white p-3 rounded-xl border border-slate-200">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={fallasPorRefChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <RechartsTooltip />
                      <Legend iconSize={8} formatter={(val) => <span className="text-xs font-bold text-slate-600">{val}</span>} />
                      {defectsByReference.map(refItem => (
                        <Bar
                          key={refItem.referencia}
                          dataKey={refItem.referencia}
                          name={`Tela ${refItem.referencia}`}
                          fill={REF_COLORS[refItem.referencia] || '#64748b'}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 3: PLANILLA DETALLADA DE INSPECCIONES (CON FALLA PRINCIPAL)
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'planilla' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          {/* Barra de Filtros y Búsqueda */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por diseño, referencia, técnica, revisadoras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-800"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botón para expandir desglose completo de defectos (como en el Excel) */}
              <button
                type="button"
                onClick={() => setShowAllDefectColumns(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  showAllDefectColumns
                    ? 'bg-rose-50 text-rose-700 border-rose-300 font-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAllDefectColumns ? 'Ocultar Columnas de Fallas' : 'Ver Columnas de Fallas (8)'}</span>
              </button>

              {/* Filtro Severidad */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterSeverity('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({timeFilteredRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('optimo')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'optimo' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  &lt;1.5% Óptimo
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('alerta')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'alerta' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  1.5% - 3% Alerta
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('critico')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'critico' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  &gt;3% Crítico
                </button>
              </div>
            </div>

            {/* Selector de Orden */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Ordenar:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="fecha">Fecha</option>
                <option value="revisadas">Mayor Cant. Revisada</option>
                <option value="pctEstampado">Mayor % Estampado</option>
                <option value="tintoreria">Mayor Def. Tintorería</option>
                <option value="tejeduria">Mayor Def. Tejeduría</option>
                <option value="totalSegundas">Mayor Segundas Totales</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-xs"
              >
                {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>

          {/* Tabla de Registros */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3 whitespace-nowrap">Fecha / Tela Base</th>
                  <th className="py-2.5 px-3">Técnica</th>
                  <th className="py-2.5 px-3">Diseño (Referencia)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Medidas</th>
                  <th className="py-2.5 px-3 text-right">Revisadas</th>
                  <th className="py-2.5 px-3 text-right">Primeras (Buenas)</th>
                  <th className="py-2.5 px-3 text-right">Pegas</th>
                  <th className="py-2.5 px-3 text-right">Arr. Lat.</th>
                  <th className="py-2.5 px-3 text-right">Arr. Cab.</th>
                  <th className="py-2.5 px-3 text-right text-rose-700">Def. Estampado (Tipo)</th>

                  {/* Columnas expandidas de defectos de estampado si showAllDefectColumns es true */}
                  {showAllDefectColumns && (
                    <>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Manchas</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Falta Pint.</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Repise</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Grasa</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Penetrac.</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Descases</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Quemadas</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Logos</th>
                    </>
                  )}

                  <th className="py-2.5 px-3 text-center text-rose-700">% Estamp.</th>
                  <th className="py-2.5 px-3 text-right text-cyan-800">Def. Tintorería (Tipo)</th>
                  <th className="py-2.5 px-3 text-center text-cyan-800">% Tint.</th>
                  <th className="py-2.5 px-3 text-right text-emerald-800">Def. Tejeduría (Tipo)</th>
                  <th className="py-2.5 px-3 text-center text-emerald-800">% Tejed.</th>
                  <th className="py-2.5 px-3 text-right">Tot. Segundas</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={showAllDefectColumns ? 25 : 17} className="py-8 text-center text-slate-400">
                      No se encontraron registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isCritical = (r.pctEstampado || 0) > 0.03;
                    const isAlert = (r.pctEstampado || 0) >= 0.015 && (r.pctEstampado || 0) <= 0.03;
                    const pctEstColor = isCritical
                      ? 'text-rose-700 bg-rose-100'
                      : isAlert
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-emerald-700 bg-emerald-100';

                    const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
                    const topDef = getTopDefect(r);
                    const summary = getDefectsSummary(r);

                    const totTint = r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0;
                    const pctTint = r.cantTotalRevisada > 0 ? totTint / r.cantTotalRevisada : 0;
                    const topTint = getTopTintoreriaDefect(r);
                    const isTintCritical = pctTint > 0.03;
                    const isTintAlert = pctTint >= 0.015 && pctTint <= 0.03;
                    const pctTintColor = isTintCritical
                      ? 'text-rose-700 bg-rose-100'
                      : isTintAlert
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-emerald-700 bg-emerald-100';

                    const totTej = r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0;
                    const pctTej = r.cantTotalRevisada > 0 ? totTej / r.cantTotalRevisada : 0;
                    const topTej = getTopTejeduriaDefect(r);
                    const isTejCritical = pctTej > 0.03;
                    const isTejAlert = pctTej >= 0.015 && pctTej <= 0.03;
                    const pctTejColor = isTejCritical
                      ? 'text-rose-700 bg-rose-100'
                      : isTejAlert
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-emerald-700 bg-emerald-100';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{r.fecha}</p>
                          <span className="text-[10px] font-semibold text-slate-500 font-mono">Tela {r.referencia}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            tec === 'REACTIVO'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {tec}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-black text-slate-800">{r.diseno}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.revisadoras}>
                            {r.revisadoras}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {r.dimensiones}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                          {fmtInt(r.cantTotalRevisada)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-emerald-700">{fmtInt(r.cantBuena)}</span>
                          <span className="block text-[9px] text-slate-400">
                            {fmtPct(r.cantBuena / (r.cantTotalRevisada || 1), 1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {fmtInt(r.pegas)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          <span>{fmtInt(r.arreLaterales)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctLaterales, 1)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          <span>{fmtInt(r.arreCabeceras)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctCabeceras, 1)}</span>
                        </td>

                        {/* Columna Def. Estampado con IDENTIFICADOR CLARO DEL TIPO DE FALLA */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(r)}
                            className="text-right cursor-pointer group"
                            title={summary}
                          >
                            <span className="font-mono font-black text-rose-700 group-hover:underline">
                              {fmtInt(r.defectosEstampado?.totalEstampado || 0)}
                            </span>
                            {topDef && (
                              <span className="block text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.2 rounded mt-0.5 truncate max-w-[110px]">
                                {topDef.name}: {topDef.count}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Columnas expandidas de los 8 defectos */}
                        {showAllDefectColumns && (
                          <>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.manchas || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.faltaPintura || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.repise || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.grasa || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.penetracion || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.descases || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.quemadas || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.logosCorridos || 0}</td>
                          </>
                        )}

                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md ${pctEstColor}`}>
                            {fmtPct(r.pctEstampado)}
                          </span>
                        </td>

                        {/* Columna Def. Tintorería (Tipo) */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(r)}
                            className="text-right cursor-pointer group"
                            title={`Fallas de Tintorería: ${totTint}`}
                          >
                            <span className="font-mono font-black text-cyan-800 group-hover:underline">
                              {fmtInt(totTint)}
                            </span>
                            {topTint && (
                              <span className="block text-[9px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-1 py-0.2 rounded mt-0.5 truncate max-w-[110px]">
                                {topTint.name}: {topTint.count}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md ${pctTintColor}`}>
                            {fmtPct(pctTint)}
                          </span>
                        </td>

                        {/* Columna Def. Tejeduría (Tipo) */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(r)}
                            className="text-right cursor-pointer group"
                            title={`Fallas de Tejeduría: ${totTej}`}
                          >
                            <span className="font-mono font-black text-emerald-800 group-hover:underline">
                              {fmtInt(totTej)}
                            </span>
                            {topTej && (
                              <span className="block text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded mt-0.5 truncate max-w-[110px]">
                                {topTej.name}: {topTej.count}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md ${pctTejColor}`}>
                            {fmtPct(pctTej)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-amber-800">{fmtInt(r.totalSegundas)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctTotalSegundas, 1)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailRecord(r)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Ver detalle de fallas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(r)}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Editar fila"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de Tabla con Totales */}
          <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Mostrando <strong className="text-slate-900">{filteredRecords.length}</strong> de {timeFilteredRecords.length} inspecciones filtradas
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="text-slate-600">Revisadas: <strong className="text-slate-900">{fmtInt(totals.revisada)}</strong></span>
              <span className="text-emerald-700">Primeras: <strong className="text-emerald-800">{fmtInt(totals.buena)}</strong></span>
              <span className="text-rose-700">Def. Estampado: <strong className="text-rose-800">{fmtInt(totals.estampado)}</strong></span>
              <span className="text-cyan-800">Def. Tintorería: <strong className="text-cyan-900">{fmtInt(totals.tintoreria)}</strong></span>
              <span className="text-emerald-800">Def. Tejeduría: <strong className="text-emerald-900">{fmtInt(totals.tejeduria)}</strong></span>
              <span className="text-amber-700">Segundas: <strong className="text-amber-800">{fmtInt(totals.totalSegundas)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 4: MATRIZ PARETO
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'pareto' && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Matriz de Defectos de Estampación y Regla 80/20
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Causas prioritarias identificadas en planta durante el periodo evaluado.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2 px-3">Tipo de Defecto</th>
                  <th className="py-2 px-3 text-right">Cantidad (Piezas)</th>
                  <th className="py-2 px-3 text-right">% Frecuencia</th>
                  <th className="py-2 px-3 text-right">% Acumulado</th>
                  <th className="py-2 px-3">Clasificación</th>
                  <th className="py-2 px-3">Causa Común en Taller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paretoDefectosData.map((d) => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                      {fmtInt(d.count)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {d.pct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                      {d.cumulativePct}%
                    </td>
                    <td className="py-2.5 px-3">
                      {d.cumulativePct <= 80 ? (
                        <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                          Prioridad A (80%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Secundaria (20%)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {d.name === 'Manchas' && 'Salpicaduras de rasqueta o exceso de carga'}
                      {d.name === 'Falta Pintura' && 'Malla tapada por secado o presión irregular'}
                      {d.name === 'Repise' && 'Doble pasada o movimiento de toalla'}
                      {d.name === 'Grasa' && 'Lubricante de cadenas o contacto mecánico'}
                      {d.name === 'Penetración' && 'Viscosidad baja de pasta reactiva'}
                      {d.name === 'Descases' && 'Descalce de marcos en registro'}
                      {d.name === 'Quemadas' && 'Sobretemperatura en túnel'}
                      {d.name === 'Logos Corridos' && 'Estiramiento en mesa de estampado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE COMPLETO DE UN LOTE ── */}
      {selectedDetailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  Detalle de Inspección
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedDetailRecord.diseno} ({selectedDetailRecord.referencia})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center font-mono">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Estampadas</p>
                  <p className="text-sm font-black text-slate-800">{fmtInt(selectedDetailRecord.cantTotalRevisada)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Primeras</p>
                  <p className="text-sm font-black text-emerald-700">{fmtInt(selectedDetailRecord.cantBuena)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-700 font-bold uppercase">Segundas</p>
                  <p className="text-sm font-black text-amber-800">{fmtInt(selectedDetailRecord.totalSegundas)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-rose-600 font-bold uppercase">% Estampado</p>
                  <p className="text-sm font-black text-rose-700">{fmtPct(selectedDetailRecord.pctEstampado)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Desglose de Todos los Defectos de Estampado:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Manchas', val: selectedDetailRecord.defectosEstampado?.manchas || 0, isRed: true },
                    { label: 'Falta Pintura', val: selectedDetailRecord.defectosEstampado?.faltaPintura || 0, isRed: true },
                    { label: 'Repise', val: selectedDetailRecord.defectosEstampado?.repise || 0, isRed: true },
                    { label: 'Grasa', val: selectedDetailRecord.defectosEstampado?.grasa || 0, isRed: true },
                    { label: 'Penetración', val: selectedDetailRecord.defectosEstampado?.penetracion || 0 },
                    { label: 'Descases', val: selectedDetailRecord.defectosEstampado?.descases || 0 },
                    { label: 'Quemadas', val: selectedDetailRecord.defectosEstampado?.quemadas || 0 },
                    { label: 'Logos Corridos', val: selectedDetailRecord.defectosEstampado?.logosCorridos || 0 },
                  ].map(d => (
                    <div key={d.label} className={`p-2 rounded-xl text-center border ${d.isRed ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[10px] text-slate-500 block truncate">{d.label}</span>
                      <strong className={`text-sm font-mono font-black ${d.isRed ? 'text-rose-700' : 'text-slate-800'}`}>
                        {d.val}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const segOtros = Math.max(0, (selectedDetailRecord.cantTotalRevisada || 0) - ((selectedDetailRecord.cantBuena || 0) + (selectedDetailRecord.pegas || 0) + (selectedDetailRecord.arreLaterales || 0) + (selectedDetailRecord.arreCabeceras || 0) + (selectedDetailRecord.defectosEstampado?.totalEstampado || 0)));
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 block">Pegas</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.pegas}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 block">Arr. Laterales</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.arreLaterales}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <span className="text-[10px] text-slate-400 block">Arr. Cabeceras</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.arreCabeceras}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-100 text-center">
                      <span className="text-[10px] text-purple-700 block font-bold">Seg. Otros Procesos</span>
                      <span className="font-bold text-purple-800 font-mono">{segOtros}</span>
                    </div>
                  </div>
                );
              })()}

              {selectedDetailRecord.observaciones && (
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-amber-900">
                  <strong>Observación:</strong> {selectedDetailRecord.observaciones}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA / EDITAR INSPECCIÓN ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                {editingRecord ? 'Editar Inspección de Calidad' : 'Nueva Inspección de Segundas'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Técnica</label>
                  <select
                    value={formTecnica}
                    onChange={(e) => setFormTecnica(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800"
                  >
                    <option value="REACTIVO">REACTIVO</option>
                    <option value="PIGMENTO">PIGMENTO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: C280T"
                    value={formReferencia}
                    onChange={(e) => setFormReferencia(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Medidas / Gramaje</label>
                  <input
                    type="text"
                    placeholder="ej: 60*120-280"
                    value={formDimensiones}
                    onChange={(e) => setFormDimensiones(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Diseño</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: C MINNIE"
                    value={formDiseno}
                    onChange={(e) => setFormDiseno(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Revisadoras (Equipo)</label>
                  <input
                    type="text"
                    placeholder="ej: BLANCA-MAYULIS-HEIDY-TATIANA"
                    value={formRevisadoras}
                    onChange={(e) => setFormRevisadoras(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                  Cantidades de Producción (Balance: Revisadas − Seg. Taller − Seg. Otros Procesos = Primeras)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Total Revisadas</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formTotalRevisada}
                      onChange={(e) => setFormTotalRevisada(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1">Primeras (Buenas)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formCantBuena}
                      onChange={(e) => setFormCantBuena(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-emerald-300 font-bold font-mono text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Pegas</label>
                    <input
                      type="number"
                      min="0"
                      value={formPegas}
                      onChange={(e) => setFormPegas(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-700 mb-1">Arr. Laterales</label>
                    <input
                      type="number"
                      min="0"
                      value={formArrLat}
                      onChange={(e) => setFormArrLat(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-sky-300 font-mono text-sky-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 mb-1">Arr. Cabeceras</label>
                    <input
                      type="number"
                      min="0"
                      value={formArrCab}
                      onChange={(e) => setFormArrCab(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 font-mono text-indigo-800"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/40 p-3 rounded-2xl border border-rose-200/70">
                <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider block mb-2">
                  Defectos Directos de Estampación (Piezas)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Manchas', val: formManchas, set: setFormManchas },
                    { label: 'Falta Pintura', val: formFaltaPintura, set: setFormFaltaPintura },
                    { label: 'Repise', val: formRepise, set: setFormRepise },
                    { label: 'Grasa', val: formGrasa, set: setFormGrasa },
                    { label: 'Penetración', val: formPenetracion, set: setFormPenetracion },
                    { label: 'Descases', val: formDescases, set: setFormDescases },
                    { label: 'Quemadas', val: formQuemadas, set: setFormQuemadas },
                    { label: 'Logos Corridos', val: formLogosCorridos, set: setFormLogosCorridos },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{f.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={f.val}
                        onChange={(e) => f.set(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance de Producción en Tiempo Real (Mini Control Dashboard) */}
              {(() => {
                const totalEstLive =
                  formManchas + formRepise + formFaltaPintura + formLogosCorridos +
                  formPenetracion + formGrasa + formDescases + formQuemadas;
                const totalSegTallerLive = formPegas + formArrLat + formArrCab + totalEstLive;
                const otrosProcesosLive = formTotalRevisada - (formCantBuena + totalSegTallerLive);
                const isBalanced = otrosProcesosLive === 0;
                const isOverTotal = otrosProcesosLive < 0;

                const pctBuenas = formTotalRevisada > 0 ? ((formCantBuena / formTotalRevisada) * 100).toFixed(1) : '0';
                const pctTaller = formTotalRevisada > 0 ? ((totalSegTallerLive / formTotalRevisada) * 100).toFixed(1) : '0';
                const pctOtros = formTotalRevisada > 0 && otrosProcesosLive > 0 ? ((otrosProcesosLive / formTotalRevisada) * 100).toFixed(1) : '0';

                return (
                  <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100/70 rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3">
                    {/* Encabezado y Estado */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          isOverTotal ? 'bg-rose-100 text-rose-700' : isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs block leading-tight">
                            Balance del Lote en Tiempo Real
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Revisadas = Primeras + Seg. Taller + Seg. Otros Procesos
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 font-black px-2.5 py-1 rounded-xl text-[10px] border shadow-2xs ${
                        isOverTotal
                          ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          : isBalanced
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {isOverTotal && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        {isBalanced && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {!isBalanced && !isOverTotal && <Factory className="w-3.5 h-3.5 text-purple-600" />}
                        {isOverTotal
                          ? `Exceso de ${Math.abs(otrosProcesosLive)} pz sobre revisadas`
                          : isBalanced
                            ? '✓ 100% Cuadre exacto (Taller)'
                            : `${otrosProcesosLive} pz Segundas Otros Procesos`}
                      </span>
                    </div>

                    {/* Barra visual de distribución porcentual */}
                    {formTotalRevisada > 0 && (
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, (formCantBuena / formTotalRevisada) * 100))}%` }}
                          className="bg-emerald-500 h-full transition-all duration-300"
                          title={`Primeras Buenas: ${formCantBuena} (${pctBuenas}%)`}
                        />
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, (totalSegTallerLive / formTotalRevisada) * 100))}%` }}
                          className="bg-amber-500 h-full transition-all duration-300"
                          title={`Segundas Taller: ${totalSegTallerLive} (${pctTaller}%)`}
                        />
                        {otrosProcesosLive > 0 && (
                          <div
                            style={{ width: `${Math.min(100, (otrosProcesosLive / formTotalRevisada) * 100)}%` }}
                            className="bg-purple-500 h-full transition-all duration-300"
                            title={`Segundas Otros Procesos: ${otrosProcesosLive} (${pctOtros}%)`}
                          />
                        )}
                      </div>
                    )}

                    {/* 4 Mini Tarjetas de Distribución */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Revisadas</span>
                        <span className="text-sm font-black text-slate-900 font-mono">{formTotalRevisada}</span>
                        <span className="text-[9px] text-slate-400 block">100% lote</span>
                      </div>

                      <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-emerald-700 block uppercase">1ª Buenas</span>
                        <span className="text-sm font-black text-emerald-800 font-mono">{formCantBuena}</span>
                        <span className="text-[9px] text-emerald-600 font-semibold block">{pctBuenas}%</span>
                      </div>

                      <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-amber-800 block uppercase">Seg. Taller</span>
                        <span className="text-sm font-black text-amber-900 font-mono">{totalSegTallerLive}</span>
                        <span className="text-[9px] text-amber-700 font-semibold block">{pctTaller}% ({formPegas}p·{formArrLat+formArrCab}a·{totalEstLive}e)</span>
                      </div>

                      <div className={`p-2 rounded-xl border shadow-2xs ${
                        isOverTotal ? 'bg-rose-50 border-rose-200' : 'bg-purple-50/60 border-purple-200/80'
                      }`}>
                        <span className={`text-[9px] font-bold block uppercase ${isOverTotal ? 'text-rose-700' : 'text-purple-700'}`}>
                          {isOverTotal ? 'Descuadre' : 'Seg. Otros Proc.'}
                        </span>
                        <span className={`text-sm font-black font-mono ${isOverTotal ? 'text-rose-800' : 'text-purple-900'}`}>
                          {otrosProcesosLive}
                        </span>
                        <span className={`text-[9px] font-semibold block ${isOverTotal ? 'text-rose-600' : 'text-purple-600'}`}>
                          {isOverTotal ? 'Exceso' : `${pctOtros}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  placeholder="ej: Ajuste de rasqueta en segundo turno..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  {editingRecord ? 'Guardar Cambios' : 'Registrar Inspección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTIÓN DE DISEÑOS VISIBLES (TOP DISEÑOS) ── */}
      {isDesignManagerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Gestión de Diseños Visibles
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Activa o desactiva qué diseños ver en el gráfico
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignManagerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Búsqueda y Filtros */}
            <div className="p-3.5 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[170px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    placeholder="Buscar por nombre de diseño..."
                    className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                  {modalSearch && (
                    <button
                      type="button"
                      onClick={() => setModalSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-bold">
                  {(['all', 'REACTIVO', 'PIGMENTO'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalProcessFilter(p)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        modalProcessFilter === p
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p === 'all' ? 'Todos' : p === 'REACTIVO' ? 'Reactivo' : 'Pigmento'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={showAllDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    Mostrar todos
                  </button>
                  <button
                    type="button"
                    onClick={hideAllDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <EyeOff className="w-3 h-3 text-slate-500" />
                    Ocultar todos
                  </button>
                  <button
                    type="button"
                    onClick={invertHiddenDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    Invertir
                  </button>
                </div>

                <span className="text-[11px] font-bold text-slate-500">
                  {allTopDesigns.length - hiddenTopDesigns.length} de {allTopDesigns.length} visibles
                </span>
              </div>
            </div>

            {/* Lista de diseños con toggle individual */}
            <div className="overflow-y-auto p-2 sm:p-3 space-y-1 custom-scrollbar flex-1 max-h-[360px]">
              {modalDesignsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  No se encontraron diseños con ese filtro.
                </div>
              ) : (
                modalDesignsList.map(d => {
                  const isHidden = hiddenTopDesigns.includes(d.name);
                  const isReactivo = d.process === 'REACTIVO';
                  const metricUnit = TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.unit || 'pz';
                  let metricVal = 0;
                  if (topDesignMetric === 'segundas') metricVal = d.totalSegundas;
                  else if (topDesignMetric === 'estampado') metricVal = d.defectosEstampado;
                  else if (topDesignMetric === 'revisadas') metricVal = d.totalRevisadas;
                  else if (topDesignMetric === 'pctSegundas') metricVal = d.pctSegundas;

                  return (
                    <div
                      key={d.name}
                      onClick={() => toggleHideDesign(d.name)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isHidden
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-60 hover:opacity-100 hover:bg-slate-100'
                          : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isHidden
                            ? 'border border-slate-300 bg-white text-transparent'
                            : 'bg-blue-600 text-white'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold uppercase truncate ${isHidden ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {d.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                              isReactivo ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.process}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {d.count} lote{d.count === 1 ? '' : 's'} · Segundas: {fmtInt(d.totalSegundas)} ({d.pctSegundas}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-xs font-black text-slate-800">
                          {topDesignMetric === 'pctSegundas' ? `${metricVal}%` : fmtInt(metricVal)} <span className="text-[10px] font-semibold text-slate-400">{metricUnit}</span>
                        </span>
                        <div
                          title={isHidden ? 'Clic para mostrar' : 'Clic para ocultar'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHidden ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={showAllDesigns}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Mostrar todos
              </button>
              <button
                type="button"
                onClick={() => setIsDesignManagerOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Listo ({allTopDesigns.length - hiddenTopDesigns.length} visibles)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modern Floating Toast Notification ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-none p-2">
          <div
            className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-slate-900/95 text-white border-emerald-500/40 shadow-emerald-950/30'
                : toast.type === 'error'
                ? 'bg-slate-900/95 text-white border-rose-500/40 shadow-rose-950/30'
                : 'bg-slate-900/95 text-white border-blue-500/40 shadow-blue-950/30'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                toast.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : toast.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 stroke-[2.5]" />}
              {toast.type === 'info' && <Info className="w-5 h-5 stroke-[2.5]" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                  {toast.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Carga Periódica de Excel (Acumular Historial vs Reemplazar) ── */}
      {importPending && (
        <div className="fixed inset-0 z-[9997] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Carga Mensual de Planilla de Calidad</h3>
                  <p className="text-xs text-emerald-100 font-medium truncate max-w-[280px]">
                    {importPending.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportPending(null)}
                className="p-1.5 rounded-xl hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Resumen de Detección */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">En Archivo</span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{importPending.importedRecords.length}</p>
                  <span className="text-[10px] text-slate-500 font-medium">registros</span>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">En Historial</span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{records.length}</p>
                  <span className="text-[10px] text-slate-500 font-medium">guardados</span>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Nuevos</span>
                  <p className="text-lg font-black text-emerald-700 mt-0.5">+{importPending.newRecords.length}</p>
                  <span className="text-[10px] text-emerald-600 font-medium">a incorporar</span>
                </div>
              </div>

              {/* Períodos detectados */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Mes(es) detectado(s) en este archivo:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {importPending.detectedMonths.map(m => (
                    <span key={m.key} className="px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-900 text-xs font-extrabold border border-emerald-200">
                      {m.label} ({m.count} lotes)
                    </span>
                  ))}
                </div>
                {importPending.duplicatesCount > 0 && (
                  <p className="text-[11px] text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{importPending.duplicatesCount} registros ya existían en el historial y se conservarán sin duplicar.</span>
                  </p>
                )}
              </div>

              {/* Opciones de carga */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-slate-800">
                  ¿Cómo deseas cargar esta planilla mensual?
                </p>

                {/* Opción A: Acumular (Recomendada) */}
                <button
                  type="button"
                  onClick={handleConfirmAccumulate}
                  className="w-full text-left p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 hover:bg-emerald-100/80 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-950">Acumular y Mantener Todo el Historial</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white tracking-wider">Recomendado</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium mt-0.5 leading-relaxed">
                        Mantiene intactos todos los meses anteriores ({records.length} registros) y agrega los {importPending.newRecords.length} nuevos lotes de este mes.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Opción B: Reemplazar */}
                <button
                  type="button"
                  onClick={handleConfirmReplace}
                  className="w-full text-left p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 group-hover:text-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800">Reemplazar Todo el Historial</span>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                        Borra el historial previo y deja únicamente los {importPending.importedRecords.length} registros de este archivo.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setImportPending(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal / Panel Lateral de Auditoría de Carga de Archivo Excel ── */}
      {isImportAuditDrawerOpen && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                    Auditoría de Carga y Validación Excel
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      10/10 Columnas OK
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Diagnóstico estructural y trazabilidad del último archivo procesado en el taller
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportAuditDrawerOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Tarjetas de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Archivo Actual</p>
                  <p className="text-xs font-black text-slate-900 truncate mt-1" title={lastImportAudit.fileName}>
                    {lastImportAudit.fileName}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hoja: {lastImportAudit.sheetName || 'Datos'}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Filas</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{fmtInt(lastImportAudit.totalRowsRead)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{lastImportAudit.validRecordsCount} registros válidos</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Nuevos Lotes</p>
                  <p className="text-base font-black text-emerald-700 mt-0.5">+{fmtInt(lastImportAudit.newRecordsCount)}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Incorporados al historial</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Duplicados</p>
                  <p className="text-base font-black text-amber-700 mt-0.5">{fmtInt(lastImportAudit.duplicatesCount)}</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Protegidos sin duplicar</p>
                </div>
              </div>

              {/* Meses Detectados en la Importación */}
              {lastImportAudit.detectedMonths && lastImportAudit.detectedMonths.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70">
                  <p className="text-[10px] font-black uppercase text-blue-900 tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Períodos identificados en el archivo:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lastImportAudit.detectedMonths.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-900 text-xs font-bold shadow-2xs">
                        <span>{m.label}:</span>
                        <span className="text-blue-600 font-extrabold">{fmtInt(m.count)} lotes</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Validación de Columnas Obligatorias (10 Columnas) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    Checklist de Integridad de Columnas ({lastImportAudit.columnsDetected.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Estructura oficial Contex</span>
                </div>
                <div className="border border-slate-200/90 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {lastImportAudit.columnsDetected.map((c, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400">{c.note || 'Ubicación y formato validados'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                          {c.col}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          CORRECTO
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">
                Última sincronización: {new Date(lastImportAudit.uploadDate).toLocaleString('es-CO')}
              </span>
              <button
                type="button"
                onClick={() => setIsImportAuditDrawerOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Desglose Interactivo de Lotes para Reprocesos (Arreglos Cabeceras, Laterales, Pegas, etc.) ── */}
      {reprocesoModal && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Scissors className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 truncate">
                    <span>{reprocesoModal.title}</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                      {reprocesoLots.length} {reprocesoLots.length === 1 ? 'lote afectado' : 'lotes afectados'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">
                    {reprocesoModal.subtitle} — Desglose exacto lote a lote para jefes de taller y planta
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {/* Botón Exportar Excel */}
                <button
                  type="button"
                  onClick={exportReprocesoModalExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Exportar esta lista a Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                {/* Botón Exportar PDF */}
                <button
                  type="button"
                  onClick={exportReprocesoModalPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Exportar esta lista a PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                {/* Cerrar */}
                <button
                  type="button"
                  onClick={() => {
                    setReprocesoModal(null);
                    setReprocesoModalSearch('');
                  }}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barra de Filtros Internos del Modal */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Buscador de Lote */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reprocesoModalSearch}
                  onChange={e => setReprocesoModalSearch(e.target.value)}
                  placeholder="Filtrar por diseño, auditor, tela u observación..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden transition-all shadow-2xs"
                />
                {reprocesoModalSearch && (
                  <button
                    type="button"
                    onClick={() => setReprocesoModalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filtro por Tela Base y Orden */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Filtro Tela */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  <span className="text-slate-400 px-1">Tela:</span>
                  <button
                    type="button"
                    onClick={() => setReprocesoModalRef('all')}
                    className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                      reprocesoModalRef === 'all' ? 'bg-cyan-600 text-white font-extrabold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas
                  </button>
                  {availableReferences.map(ref => (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => setReprocesoModalRef(ref)}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        reprocesoModalRef.toUpperCase() === ref.toUpperCase() ? 'bg-cyan-600 text-white font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {ref}
                    </button>
                  ))}
                </div>

                {/* Selector de Orden */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setReprocesoModalSort('defects_desc')}
                    className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                      reprocesoModalSort === 'defects_desc' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mayor Reproceso
                  </button>
                  <button
                    type="button"
                    onClick={() => setReprocesoModalSort('date_desc')}
                    className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                      reprocesoModalSort === 'date_desc' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Más Recientes
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla Detallada con Scroll */}
            <div className="flex-1 overflow-y-auto p-4">
              {reprocesoLots.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No se encontraron lotes con este reproceso</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {reprocesoModalSearch ? 'Ningún lote coincide con el texto de búsqueda ingresado' : 'Todos los lotes inspeccionados están libres de este defecto'}
                  </p>
                  {reprocesoModalSearch && (
                    <button
                      type="button"
                      onClick={() => setReprocesoModalSearch('')}
                      className="mt-3 px-3 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Limpiar filtro de búsqueda
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Diseño / Ref Taller</th>
                        <th className="py-2.5 px-3">Tela</th>
                        <th className="py-2.5 px-3">Revisadora(s)</th>
                        <th className="py-2.5 px-3 text-right">Total Revisadas</th>
                        <th className="py-2.5 px-3 text-right bg-cyan-950/80 text-cyan-200">
                          {reprocesoModal.type === 'cabeceras' || reprocesoModal.type === 'laterales'
                            ? 'Arreglos (Reproceso)'
                            : reprocesoModal.type === 'pegas'
                            ? 'Pegas'
                            : 'Segundas (Fallas)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">% Incidencia</th>
                        <th className="py-2.5 px-3 text-right">1ª Calidad</th>
                        <th className="py-2.5 px-3">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {reprocesoLots.map(r => (
                        <tr key={r.id} className="hover:bg-cyan-50/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {r.fecha}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-extrabold text-slate-900">{r.diseno}</span>
                            <span className={`ml-2 text-[9px] px-1.5 py-0.2 rounded-md font-extrabold ${
                              r.tecnica === 'REACTIVO' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {r.tecnica || inferTecnica(r.diseno, r.referencia)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-700">{r.referencia || '-'}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-[140px]" title={r.revisadoras}>
                            {r.revisadoras || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-800">
                            {fmtInt(r.cantTotalRevisada)}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-cyan-700 bg-cyan-50/50">
                            {fmtInt(r.faultCount)} pz
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded-md font-black text-[10px] ${
                              r.faultPct >= 8 ? 'bg-rose-100 text-rose-800' :
                              r.faultPct >= 4 ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {r.faultPct}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-emerald-700">
                            {fmtInt(r.cantBuena)}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[180px]" title={r.observaciones}>
                            {r.observaciones || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer con Métricas Totales del Reproceso */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500 font-medium">
                  Total fallas en los lotes listados: <strong className="text-slate-900 font-black">{fmtInt(reprocesoLots.reduce((acc, x) => acc + x.faultCount, 0))} pz</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium">
                  Total tela revisada: <strong className="text-slate-900 font-black">{fmtInt(reprocesoLots.reduce((acc, x) => acc + (x.cantTotalRevisada || 0), 0))} pz</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReprocesoModal(null);
                  setReprocesoModalSearch('');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Confirmation Modal ── */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden p-6 transition-all transform">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmDialog.danger
                    ? 'bg-rose-50 border-rose-100 text-rose-600'
                    : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}
              >
                {confirmDialog.danger ? (
                  <AlertTriangle className="w-6 h-6 stroke-[2]" />
                ) : (
                  <Info className="w-6 h-6 stroke-[2]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-normal">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                  confirmDialog.danger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {confirmDialog.danger && <Trash2 className="w-3.5 h-3.5" />}
                {confirmDialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GENERADOR DE INFORME EJECUTIVO PDF PERSONALIZABLE ── */}
      <SegundasReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        records={records}
        currentMonth={selectedMonth}
        currentYear={selectedYear}
        currentTimeFilter={timeFilter}
        currentStartDate={startDate}
        currentEndDate={endDate}
        showToast={showToast}
      />
    </div>
  );
}
