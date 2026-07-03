import { History, Calendar, Award, Scissors, ShoppingBag, CheckCircle } from 'lucide-react';
import { BatchLog } from '../types';

interface BatchLogListProps {
  batches: BatchLog[];
}

export default function BatchLogList({ batches }: BatchLogListProps) {
  // Calcular estadísticas útiles
  const totalGramsMixed = batches.reduce((acc, b) => acc + b.totalGrammage, 0);
  const totalKgMixed = (totalGramsMixed / 1000).toFixed(2);
  
  const totalPieces = batches.reduce((acc, b) => acc + b.quantity, 0);
  
  const towelBatches = batches.filter(b => b.productType === 'Toallas').length;
  const hammockBatches = batches.filter(b => b.productType === 'Hamacas').length;

  // Encontrar el operador con más mezclas
  const operatorCounts = batches.reduce((acc: Record<string, number>, b) => {
    acc[b.operator] = (acc[b.operator] || 0) + 1;
    return acc;
  }, {});

  let topOperator = 'Ninguno';
  let maxBatches = 0;
  Object.entries(operatorCounts).forEach(([name, count]) => {
    if (count > maxBatches) {
      maxBatches = count;
      topOperator = name;
    }
  });

  return (
    <div className="space-y-6 h-full flex flex-col overflow-hidden" id="batches-history-view">
      
      {/* Cards de Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Mezclas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Mezclado</p>
            <p className="text-xl font-extrabold text-slate-800">{totalKgMixed} kg</p>
            <p className="text-[9px] text-slate-400 font-medium">En {batches.length} preparaciones</p>
          </div>
        </div>

        {/* Total Piezas Estampadas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Piezas Totales</p>
            <p className="text-xl font-extrabold text-slate-800">{totalPieces.toLocaleString()}</p>
            <p className="text-[9px] text-slate-400 font-medium">Toallas & Hamacas</p>
          </div>
        </div>

        {/* Toallas vs Hamacas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distribución</p>
            <p className="text-sm font-extrabold text-slate-800">
              {towelBatches} Toallas / {hammockBatches} Hamacas
            </p>
            <p className="text-[9px] text-slate-400 font-medium">Por lotes registrados</p>
          </div>
        </div>

        {/* Operador Estrella */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mezclador Principal</p>
            <p className="text-sm font-extrabold text-slate-800 truncate max-w-[130px]">{topOperator}</p>
            <p className="text-[9px] text-slate-400 font-medium">{maxBatches} lotes preparados</p>
          </div>
        </div>

      </div>

      {/* Tabla de Historial */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex-1 flex flex-col overflow-hidden">
        <h3 className="text-md font-bold text-slate-800 mb-4">Registro de Lotes de Producción (Últimas Preparaciones)</h3>
        
        <div className="flex-1 overflow-y-auto">
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
              <History className="w-10 h-10 text-slate-300 mb-2 animate-bounce" />
              <p className="text-sm font-medium">No hay lotes preparados aún</p>
              <p className="text-xs">Registra tu primera mezcla de color en la pestaña "Catálogo Pantones"</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/40">
                  <th className="py-2.5 px-4 font-semibold">Tono Pantone</th>
                  <th className="py-2.5 px-4 font-semibold">Producto</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Mezcla (g)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Cant. Estampada</th>
                  <th className="py-2.5 px-4 font-semibold">Operario</th>
                  <th className="py-2.5 px-4 font-semibold">Fecha / Hora</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {batches.map((batch) => {
                  let dateStr = 'Reciente';
                  if (batch.timestamp) {
                    const dateObj = batch.timestamp.toDate ? batch.timestamp.toDate() : new Date(batch.timestamp);
                    dateStr = dateObj.toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }
                  
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-slate-200" 
                            style={{ backgroundColor: batch.pantoneHex }}
                          />
                          {batch.pantoneCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          batch.productType === 'Toallas' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {batch.productType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">{batch.totalGrammage}g</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{batch.quantity} piezas</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{batch.operator}</td>
                      <td className="py-3 px-4 text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          Completado
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
