import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie, ComposedChart, Line, Area, AreaChart
} from 'recharts';
import { TrendingUp, Layers, Search, X, Droplets, Palette, Scale, Award, Zap, CheckCircle } from 'lucide-react';

export interface InkTimelinePoint {
  label: string;
  Pigmento: number;
  Reactivo: number;
  Aditivo: number;
  acumulado: number;
  unidades?: number;
  golpes?: number;
  kgTela?: number;
  rendimientoGPorPrenda?: number;
}

export interface InkItem {
  code: string;
  kg: number;
  hex?: string;
  isAdditive?: boolean;
  category?: string;
}

export interface PantoneItem {
  code: string;
  kg: number;
  hex?: string;
  lots: number;
}

export interface ComparisonPoint {
  label: string;
  Preparado: number;
  Consumido: number;
}

interface InkChartsProps {
  weightUnit: 'kg' | 'g';
  logTypeFilter: 'all' | 'preparacion' | 'consumo';
  lineTypeFilter: 'all' | 'pigmento' | 'reactivo' | 'aditivo';
  onLineTypeChange: (v: 'all' | 'pigmento' | 'reactivo' | 'aditivo') => void;
  timeline: InkTimelinePoint[];
  groupedByMonth: boolean;
  inks: InkItem[];
  pantones: PantoneItem[];
  comparison: ComparisonPoint[];
  totalProductionUnits?: number;
  totalProductionKg?: number;
  totalProductionGolpes?: number;
}

const LINE_COLORS = { Pigmento: '#f59e0b', Reactivo: '#8b5cf6', Aditivo: '#0ea5e9' } as const;
const FALLBACK_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ef4444', '#14b8a6'];

const tooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

export default function InkCharts({
  weightUnit, logTypeFilter, lineTypeFilter, onLineTypeChange,
  timeline, groupedByMonth, inks, pantones, comparison,
  totalProductionUnits, totalProductionKg, totalProductionGolpes
}: InkChartsProps) {
  const [inkSearch, setInkSearch] = useState('');
  const [topN, setTopN] = useState<number>(10);
  const [showPantoneAll, setShowPantoneAll] = useState(false);
  const [timelineMode, setTimelineMode] = useState<'both' | 'units' | 'accum'>('both');

  const unit = weightUnit === 'kg' ? 'kg' : 'g';
  const fmt = (n: number) =>
    n.toLocaleString('es-ES', {
      minimumFractionDigits: weightUnit === 'kg' ? 2 : 0,
      maximumFractionDigits: weightUnit === 'kg' ? 2 : 0,
    });

  const opLabel = logTypeFilter === 'consumo' ? 'Consumo' : logTypeFilter === 'preparacion' ? 'Preparación' : 'Registro';

  // Distribución por línea (derivada de la serie temporal)
  const lineDistribution = useMemo(() => {
    const totals = { Pigmento: 0, Reactivo: 0, Aditivo: 0 };
    timeline.forEach(p => {
      totals.Pigmento += p.Pigmento;
      totals.Reactivo += p.Reactivo;
      totals.Aditivo += p.Aditivo;
    });
    return (Object.keys(totals) as (keyof typeof totals)[])
      .map(name => ({ name, value: Number(totals[name].toFixed(2)), color: LINE_COLORS[name] }))
      .filter(d => d.value > 0);
  }, [timeline]);
  const lineTotal = lineDistribution.reduce((a, d) => a + d.value, 0);

  // Insumos filtrados / limitados
  const inkTotal = inks.reduce((a, i) => a + i.kg, 0);
  const filteredInks = useMemo(() => {
    const q = inkSearch.trim().toLowerCase();
    const list = q ? inks.filter(i => i.code.toLowerCase().includes(q)) : inks;
    return topN > 0 ? list.slice(0, topN) : list;
  }, [inks, inkSearch, topN]);

  const inkColor = (i: InkItem, idx: number) =>
    i.hex || (i.isAdditive ? LINE_COLORS.Aditivo : FALLBACK_COLORS[idx % FALLBACK_COLORS.length]);

  const pantoneTotal = pantones.reduce((a, p) => a + p.kg, 0);
  const visiblePantones = showPantoneAll ? pantones : pantones.slice(0, 8);

  const lineChips: { id: 'all' | 'pigmento' | 'reactivo' | 'aditivo'; label: string; active: string }[] = [
    { id: 'all', label: 'Todos', active: 'text-slate-800' },
    { id: 'reactivo', label: 'Reactivos', active: 'text-purple-700' },
    { id: 'pigmento', label: 'Pigmentos', active: 'text-amber-700' },
    { id: 'aditivo', label: 'Aditivos', active: 'text-blue-700' },
  ];

  const renderCustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload as InkTimelinePoint;
    if (!d) return null;
    const dayInk = Number(((d.Pigmento || 0) + (d.Reactivo || 0) + (d.Aditivo || 0)).toFixed(2));
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[220px]">
        <div className="border-b border-slate-700 pb-1.5 flex items-center justify-between">
          <span className="font-extrabold text-white text-sm">{d.label}</span>
          {d.unidades ? (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
              {d.unidades.toLocaleString()} pz estampadas
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tintas e Insumos:</p>
          {d.Reactivo > 0 && (
            <div className="flex justify-between items-center text-purple-300">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Reactivo:</span>
              <span className="font-mono font-bold">{fmt(d.Reactivo)} {unit}</span>
            </div>
          )}
          {d.Pigmento > 0 && (
            <div className="flex justify-between items-center text-amber-300">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Pigmento:</span>
              <span className="font-mono font-bold">{fmt(d.Pigmento)} {unit}</span>
            </div>
          )}
          {d.Aditivo > 0 && (
            <div className="flex justify-between items-center text-sky-300">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" /> Aditivo:</span>
              <span className="font-mono font-bold">{fmt(d.Aditivo)} {unit}</span>
            </div>
          )}
          <div className="flex justify-between items-center font-extrabold pt-1 border-t border-slate-800 text-slate-100">
            <span>Total Tinta:</span>
            <span className="font-mono text-blue-300 font-bold">{fmt(dayInk)} {unit}</span>
          </div>
        </div>
        {d.unidades ? (
          <div className="space-y-1 pt-1.5 border-t border-slate-700 text-slate-300">
            <p className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Producción Real:</p>
            <div className="flex justify-between items-center">
              <span>Toallas Estampadas:</span>
              <span className="font-mono font-bold text-emerald-400">{d.unidades.toLocaleString()} toallas</span>
            </div>
            {d.kgTela ? (
              <div className="flex justify-between items-center">
                <span>Tela Procesada:</span>
                <span className="font-mono font-bold text-slate-200">{d.kgTela.toLocaleString()} kg</span>
              </div>
            ) : null}
            {d.golpes ? (
              <div className="flex justify-between items-center">
                <span>Golpes de Máquina:</span>
                <span className="font-mono font-bold text-slate-200">{d.golpes.toLocaleString()}</span>
              </div>
            ) : null}
            {d.rendimientoGPorPrenda ? (
              <div className="flex justify-between items-center text-amber-300 font-bold pt-1 border-t border-slate-800">
                <span>Consumo por Prenda:</span>
                <span className="font-mono">{d.rendimientoGPorPrenda} g tinta / toalla</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6" id="ink-charts-view">
      {/* ── BANNER: Correlación Producción & Tintas ── */}
      {totalProductionUnits !== undefined && totalProductionUnits > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                  Relación Producción & Tintas
                </span>
                <span className="text-xs text-slate-400 font-medium">Balance real del taller</span>
              </div>
              <p className="text-lg font-black text-white mt-1">
                {totalProductionUnits.toLocaleString()} Unidades Estampadas
                {totalProductionKg ? <span className="text-sm font-semibold text-slate-300 ml-2">({totalProductionKg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg de tela)</span> : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 ml-auto">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tintas</p>
              <p className="text-base font-extrabold text-blue-400 font-mono">
                {fmt(inkTotal)} {unit}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block" />
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consumo por Toalla</p>
              <p className="text-base font-extrabold text-emerald-400 font-mono">
                {totalProductionUnits > 0 ? (weightUnit === 'kg' ? ((inkTotal * 1000) / totalProductionUnits).toFixed(2) : (inkTotal / totalProductionUnits).toFixed(2)) : '0'} g / toalla
              </p>
            </div>
            {totalProductionGolpes ? (
              <>
                <div className="h-8 w-px bg-slate-700 hidden sm:block" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Golpes Totales</p>
                  <p className="text-base font-extrabold text-purple-400 font-mono">
                    {totalProductionGolpes.toLocaleString()} golpes
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Fila 1: línea de tiempo + distribución por línea ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {opLabel} de tintas ({unit}) vs Producción {groupedByMonth ? 'por mes' : 'por día'}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Barras = Tintas · Línea = Producción Estampada</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setTimelineMode('both')}
                className={`px-2.5 py-1 rounded-lg transition-all ${timelineMode === 'both' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tinta vs Unidades
              </button>
              <button
                type="button"
                onClick={() => setTimelineMode('units')}
                className={`px-2.5 py-1 rounded-lg transition-all ${timelineMode === 'units' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Solo Unidades (pz)
              </button>
              <button
                type="button"
                onClick={() => setTimelineMode('accum')}
                className={`px-2.5 py-1 rounded-lg transition-all ${timelineMode === 'accum' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tinta Acumulada
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: timelineMode === 'accum' ? '#94a3b8' : '#10b981', fontWeight: 'bold' }}
                    tickFormatter={(v) => {
                      if (timelineMode === 'accum') return `${v} ${unit}`;
                      const n = Number(v);
                      return n >= 1000 ? `${(n / 1000).toFixed(0)}k pz` : `${n} pz`;
                    }}
                  />
                  <RechartsTooltip content={renderCustomTooltip} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar yAxisId="left" dataKey="Pigmento" stackId="l" fill={LINE_COLORS.Pigmento} maxBarSize={36} />
                  <Bar yAxisId="left" dataKey="Reactivo" stackId="l" fill={LINE_COLORS.Reactivo} maxBarSize={36} />
                  <Bar yAxisId="left" dataKey="Aditivo" stackId="l" fill={LINE_COLORS.Aditivo} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  {(timelineMode === 'both' || timelineMode === 'units') && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="unidades"
                      name="Unidades Estampadas (pz)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10b981' }}
                    />
                  )}
                  {(timelineMode === 'both' || timelineMode === 'accum') && (
                    <Line
                      yAxisId={timelineMode === 'both' ? 'left' : 'right'}
                      type="monotone"
                      dataKey="acumulado"
                      name={`Acumulado (${unit})`}
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray={timelineMode === 'both' ? '4 4' : undefined}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Sin datos suficientes en este periodo
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Distribución por línea</h3>
              <p className="text-[10px] text-slate-400 font-medium">Pigmento · Reactivo · Aditivos</p>
            </div>
          </div>
          {lineDistribution.length > 0 ? (
            <>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lineDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                      {lineDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any, name: any) => [`${fmt(Number(value))} ${unit}`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-1">
                {lineDistribution.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {fmt(d.value)} {unit}
                      <span className="text-slate-400 font-semibold ml-1.5">
                        ({lineTotal > 0 ? ((d.value / lineTotal) * 100).toFixed(1) : '0'}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Sin datos suficientes
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 2: insumos + pantones ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Consumo por insumo, tinta y aditivo ({unit})</h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {inks.length} insumos · total {fmt(inkTotal)} {unit}
                </p>
              </div>
            </div>
            <div className="flex bg-slate-100 rounded-xl p-0.5 text-[11px] font-bold">
              {lineChips.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onLineTypeChange(c.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${lineTypeFilter === c.id ? `bg-white ${c.active} shadow-sm` : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inkSearch}
                onChange={e => setInkSearch(e.target.value)}
                placeholder="Buscar insumo..."
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
              {inkSearch && (
                <button type="button" onClick={() => setInkSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={0}>Todos</option>
            </select>
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 ml-auto">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Aditivo</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-br from-amber-400 to-purple-500" /> Tinta (color real)</span>
            </div>
          </div>

          <div className="w-full overflow-y-auto custom-scrollbar" style={{ maxHeight: 380 }}>
            {filteredInks.length > 0 ? (
              <div style={{ height: Math.max(220, filteredInks.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredInks} layout="vertical" margin={{ top: 0, right: 70, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }}
                      width={140}
                    />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={tooltipStyle}
                      formatter={(value: any, _name: any, item: any) => {
                        const pct = inkTotal > 0 ? ((Number(value) / inkTotal) * 100).toFixed(1) : '0';
                        return [`${fmt(Number(value))} ${unit} (${pct}%)`, item?.payload?.isAdditive ? 'Aditivo / Auxiliar' : 'Tinta / Colorante'];
                      }}
                    />
                    <Bar
                      dataKey="kg"
                      radius={[0, 6, 6, 0]}
                      barSize={16}
                      label={{ position: 'right', fontSize: 10, fill: '#475569', fontWeight: 700, formatter: (v: any) => fmt(Number(v)) }}
                    >
                      {filteredInks.map((entry, i) => (
                        <Cell key={i} fill={inkColor(entry, i)} stroke="#cbd5e1" strokeWidth={0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {inkSearch ? 'Ningún insumo coincide con la búsqueda' : 'Sin datos suficientes'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Pantones más preparados</h3>
              <p className="text-[10px] text-slate-400 font-medium">{pantones.length} tonos · {fmt(pantoneTotal)} {unit}</p>
            </div>
          </div>
          {pantones.length > 0 ? (
            <>
              <div className="space-y-3 flex-1">
                {visiblePantones.map((p, i) => {
                  const share = pantoneTotal > 0 ? (p.kg / pantoneTotal) * 100 : 0;
                  const maxKg = pantones[0]?.kg || 1;
                  return (
                    <div key={`${p.code}-${i}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2 font-bold text-slate-700 min-w-0">
                          <span className="w-4 h-4 rounded-md border border-slate-300 shrink-0" style={{ backgroundColor: p.hex || '#e2e8f0' }} />
                          <span className="truncate">{p.code}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-800 shrink-0 ml-2">
                          {fmt(p.kg)} {unit}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(p.kg / maxKg) * 100}%`, backgroundColor: p.hex || '#94a3b8' }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                        {p.lots} lote{p.lots === 1 ? '' : 's'} · {share.toFixed(1)}% del total
                      </p>
                    </div>
                  );
                })}
              </div>
              {pantones.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowPantoneAll(v => !v)}
                  className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl py-2 transition-colors"
                >
                  {showPantoneAll ? 'Ver menos' : `Ver todos (${pantones.length})`}
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Sin datos suficientes
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 3: preparado vs consumido (solo vista combinada) ── */}
      {logTypeFilter === 'all' && comparison.some(c => c.Consumido > 0) && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Preparado vs Consumido ({unit})</h3>
              <p className="text-[10px] text-slate-400 font-medium">Una brecha grande entre ambas indica sobrante o merma</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparison} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPrep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => [`${fmt(Number(value))} ${unit}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Area type="monotone" dataKey="Preparado" stroke="#0ea5e9" strokeWidth={2} fill="url(#gradPrep)" />
                <Area type="monotone" dataKey="Consumido" stroke="#10b981" strokeWidth={2} fill="url(#gradCons)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
