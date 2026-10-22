import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, BarChart3, Droplets, AlertTriangle, Sliders, ChevronDown, RefreshCw, Check } from 'lucide-react';
import { PantoneColor, Design } from '../types';
import { AnalyzedColor, analyzeCanvasColors, calculateInkGrams } from '../lib/imageColorAnalysis';

type ColorData = AnalyzedColor;

interface ImageAnalyzerProps {
  pantones: PantoneColor[];
  onSaveAsDesign: (design: Design) => void;
}

export default function ImageAnalyzer({ pantones, onSaveAsDesign }: ImageAnalyzerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<ColorData[]>([]);
  
  const [widthCm, setWidthCm] = useState<number>(60);
  const [heightCm, setHeightCm] = useState<number>(120);
  const [gramaje, setGramaje] = useState<number>(280);
  const [unitWeight, setUnitWeight] = useState<number>(201.6);
  const [piezasPorGolpe, setPiezasPorGolpe] = useState<number>(3);
  const [preset, setPreset] = useState<string>('kids');
  const [tolerance, setTolerance] = useState<number>(30);
  const [minCoverage, setMinCoverage] = useState<number>(1.5);
  const [includeWhitePadding, setIncludeWhitePadding] = useState<boolean>(true);
  const [mappedPantones, setMappedPantones] = useState<Record<number, string>>({});
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setResults([]);
    }
  };

  const analyzeImage = () => {
    if (!imageSrc || !canvasRef.current) return;
    
    setAnalyzing(true);
    
    setTimeout(() => {
      const canvas = canvasRef.current!;

      // Algoritmo compartido con el editor de diseños (src/lib/imageColorAnalysis.ts)
      const analyzedColors: ColorData[] = analyzeCanvasColors(canvas, pantones, {
        widthCm,
        heightCm,
        piezasPorGolpe,
        tolerance,
        minCoverage,
        includeWhitePadding
      });

      const initialMapping: Record<number, string> = {};
      analyzedColors.forEach((r, idx) => {
        if (r.closestPantoneId) {
          initialMapping[idx] = r.closestPantoneId;
        }
      });
      setMappedPantones(initialMapping);
      setResults(analyzedColors);
      setAnalyzing(false);
    }, 100);
  };

  useEffect(() => {
    if (results.length > 0 && Object.keys(mappedPantones).length === 0) {
      const initialMapping: Record<number, string> = {};
      results.forEach((r, idx) => {
        if (r.closestPantoneId) {
          initialMapping[idx] = r.closestPantoneId;
        }
      });
      setMappedPantones(initialMapping);
    }
  }, [results, mappedPantones]);

  useEffect(() => {
    if (imageSrc && canvasRef.current) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d');
        
        const MAX_DIM = 800;
        let scale = 1;
        if (img.width > MAX_DIM || img.height > MAX_DIM) {
          scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
        }
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        analyzeImage();
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [designName, setDesignName] = useState('');
  const [designProductType, setDesignProductType] = useState<'Toallas' | 'Otros'>('Toallas');
  const [designLineType, setDesignLineType] = useState<'pigmento' | 'reactivo'>('reactivo');
  const [volumenTeorico, setVolumenTeorico] = useState<number>(15);

  const handlePresetChange = (val: string) => {
    setPreset(val);
    if (val === 'kids') {
      setWidthCm(60);
      setHeightCm(120);
      setGramaje(280);
      setUnitWeight(201.6);
      setPiezasPorGolpe(3);
      setDesignLineType('reactivo');
      setDesignProductType('Toallas');
    } else if (val === 'cocina') {
      setWidthCm(35);
      setHeightCm(60);
      setGramaje(310);
      setUnitWeight(63);
      setPiezasPorGolpe(5);
      setDesignLineType('pigmento');
      setDesignProductType('Toallas');
    }
  };

  const handleOpenSaveModal = () => {
    setDesignName('');
    setShowSaveModal(true);
  };

  const calculateGrams = (areaM2: number) => calculateInkGrams(areaM2, volumenTeorico);

  const handleSaveConfirm = () => {
    if (!designName.trim()) return alert("Debe ingresar un nombre para el diseño");
    
    for (let i = 0; i < results.length; i++) {
      if (!mappedPantones[i]) {
        return alert(`Debe asignar un color Pantone al Marco ${i + 1}`);
      }
    }

    const designColors = results.map((r, idx) => {
      const pId = mappedPantones[idx];
      const p = pantones.find(x => x.id === pId);
      const areaPorPieza = r.areaM2 / piezasPorGolpe;
      return {
        pantoneCode: p?.code || '',
        gramsPerPiece: Number(calculateGrams(areaPorPieza).toFixed(2)),
        previewUrl: r.previewUrl
      };
    });

    let finalImageUrl = '';
    if (canvasRef.current) {
      try {
        finalImageUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
      } catch (err) {
        console.error("No se pudo extraer base64 del canvas:", err);
      }
    }

    const finalUnitWeight = unitWeight > 0 ? unitWeight : Number((((widthCm * heightCm) / 10000) * gramaje).toFixed(1));

    onSaveAsDesign({
      name: designName,
      productType: designProductType,
      lineType: designLineType,
      colors: designColors,
      imageUrl: finalImageUrl,
      frames: results.length,
      gramaje: gramaje || 0,
      unitWeight: finalUnitWeight
    });
    
    setShowSaveModal(false);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative" id="image-analyzer-container">
      
      {/* ── MODAL DE GUARDADO COMO DISEÑO ── */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Guardar como Nuevo Diseño</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Asigna un tono Pantone del catálogo a cada marco detectado.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del Diseño</label>
                <input 
                  type="text" 
                  value={designName}
                  onChange={e => setDesignName(e.target.value)}
                  placeholder="Ej: Mickey Mouse Tropical"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Línea de Trabajo</label>
                <select 
                  value={designLineType}
                  onChange={e => setDesignLineType(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="pigmento">Pigmentos</option>
                  <option value="reactivo">Colorantes Reactivos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Producto</label>
                <select 
                  value={designProductType}
                  onChange={e => setDesignProductType(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Toallas">Toallas</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Peso Prenda / Unidad (g)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="any"
                    value={unitWeight}
                    onChange={e => setUnitWeight(Number(e.target.value))}
                    className="w-full p-2 pr-8 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Volumen Teórico (cm³/m²)</label>
                <input 
                  type="number" 
                  value={volumenTeorico}
                  onChange={e => setVolumenTeorico(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Mapeo de Colores a Pantone</h3>
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded shadow-inner border border-black/10 shrink-0" style={{ backgroundColor: r.hex }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">Marco {idx + 1} ({r.percentage.toFixed(1)}%)</p>
                    <select
                      value={mappedPantones[idx] || ''}
                      onChange={e => setMappedPantones(prev => ({...prev, [idx]: e.target.value}))}
                      className="w-full mt-1 p-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none bg-white truncate"
                    >
                      <option value="">-- Seleccionar Pantone --</option>
                      {pantones.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Gramos/Pz</p>
                    <p className="font-mono text-xs font-black text-blue-700">{calculateGrams(r.areaM2 / piezasPorGolpe).toFixed(1)}g</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 mt-1 pt-2 border-t border-slate-100">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveConfirm} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-md">
                Guardar Diseño
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER SUPERIOR ── */}
      <div className="p-3.5 sm:p-5 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-2.5 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-black flex items-center gap-2 truncate">
            <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />
            <span>Computer Vision: Análisis de Separación</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
            Escanea los píxeles del diseño para calcular la cobertura exacta por marco.
          </p>
        </div>
        {results.length > 0 && (
          <button 
            onClick={handleOpenSaveModal}
            className="px-3.5 py-1.5 sm:px-5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Guardar como Diseño
          </button>
        )}
      </div>

      {/* ── CUERPO PRINCIPAL ADAPTADO A MÓVILES Y DESKTOP ── */}
      <div className="p-3 sm:p-6 flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 overflow-y-auto custom-scrollbar">
        
        {/* PANEL IZQUIERDO (EN MÓVIL VA ORDENADO DE FORMA COMPACTA) */}
        <div className="lg:w-1/3 flex flex-col gap-3 sm:gap-4 shrink-0">
          
          {/* 1. ZONA DE CARGA DE FOTOLITO / IMAGEN (PRIMERO Y FÁCIL DE TOCAR) */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-3 sm:p-4 text-center hover:border-blue-400 transition-colors shadow-xs">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
            
            {imageSrc ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">Imagen Cargada</p>
                    <p className="text-[10px] text-slate-400">Píxeles listos para análisis</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={analyzeImage}
                    disabled={analyzing}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                    <span>{analyzing ? 'Analizando...' : 'Recalcular'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer py-3 flex flex-col items-center justify-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors mb-2 shadow-xs">
                  <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-blue-700">Toca para Subir Fotolito / Diseño</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG o foto desde el móvil</span>
              </div>
            )}
          </div>

          {/* 2. TARJETA COMPACTA DE DIMENSIONES DE PRENDA */}
          <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dimensiones Prenda</h3>
              <select 
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold bg-white text-slate-700 outline-none max-w-[170px] truncate shadow-xs"
              >
                <option value="kids">Toallas Kids (60x120)</option>
                <option value="cocina">Toallas Cocina (35x60)</option>
                <option value="custom">Personalizado...</option>
              </select>
            </div>

            {/* Medidas en Cuadrícula 2x2 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Ancho (cm)</span>
                <input 
                  type="number" 
                  value={widthCm} 
                  onChange={(e) => { 
                    const w = Number(e.target.value);
                    setWidthCm(w); 
                    const area = (w * heightCm) / 10000;
                    setUnitWeight(area > 0 ? Number((area * gramaje).toFixed(1)) : 0);
                    setPreset('custom'); 
                  }}
                  className="w-full font-bold text-slate-800 outline-none text-xs"
                />
              </div>

              <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Alto (cm)</span>
                <input 
                  type="number" 
                  value={heightCm} 
                  onChange={(e) => { 
                    const h = Number(e.target.value);
                    setHeightCm(h); 
                    const area = (widthCm * h) / 10000;
                    setUnitWeight(area > 0 ? Number((area * gramaje).toFixed(1)) : 0);
                    setPreset('custom'); 
                  }}
                  className="w-full font-bold text-slate-800 outline-none text-xs"
                />
              </div>

              <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Piezas / Golpe</span>
                <input 
                  type="number" 
                  value={piezasPorGolpe} 
                  onChange={(e) => { setPiezasPorGolpe(Number(e.target.value)); setPreset('custom'); }}
                  min="1"
                  className="w-full font-bold text-slate-800 outline-none text-xs"
                />
              </div>

              <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Gramaje (g/m²)</span>
                <input 
                  type="number" 
                  step="any"
                  value={gramaje} 
                  onChange={(e) => { 
                    const g = Number(e.target.value);
                    setGramaje(g); 
                    const area = (widthCm * heightCm) / 10000;
                    setUnitWeight(area > 0 ? Number((area * g).toFixed(1)) : 0);
                    setPreset('custom'); 
                  }}
                  className="w-full font-bold text-slate-800 outline-none text-xs font-mono"
                />
              </div>
            </div>

            {/* Fila Resumen Peso / Área */}
            <div className="bg-blue-50/80 px-3 py-2 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-blue-900">Peso Prenda</span>
              <div className="text-right">
                <span className="font-mono font-black text-blue-700 text-sm">{unitWeight} g/pz</span>
                <span className="text-[10px] text-blue-500 font-mono ml-1.5">({((widthCm * heightCm) / 10000).toFixed(3)} m²)</span>
              </div>
            </div>

            {/* 3. ACORDEÓN COLAPSABLE PARA CALIBRACIÓN AVANZADA (AHORRA 300PX EN MÓVIL) */}
            <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <summary className="p-2.5 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Calibración Avanzada</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-blue-600 bg-blue-50 font-bold px-1.5 py-0.5 rounded">
                    Tol: {tolerance} · Ruido: {minCoverage}%
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>

              <div className="p-3 border-t border-slate-100 space-y-3 bg-slate-50/40 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Tolerancia de Color</span>
                    <span className="font-bold text-blue-600 font-mono">{tolerance}</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" max="100" 
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Fusiona variaciones antialiasing del mismo tono.</p>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Filtro de Ruido (Mínimo %)</span>
                    <span className="font-bold text-amber-600 font-mono">{minCoverage}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" max="5" step="0.1"
                    value={minCoverage}
                    onChange={(e) => setMinCoverage(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Ignora tonos que cubran menos de este % del área.</p>
                </div>

                <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={includeWhitePadding}
                    onChange={(e) => setIncludeWhitePadding(e.target.checked)}
                    className="mt-0.5 accent-blue-600 w-3.5 h-3.5 rounded"
                  />
                  <div>
                    <p className="text-[11px] font-bold text-slate-700">Asignar márgenes blancos al fondo</p>
                    <p className="text-[9px] text-slate-400 leading-tight">Suma el espacio blanco vacío al color dominante.</p>
                  </div>
                </label>
              </div>
            </details>
          </div>
        </div>

        {/* PANEL DERECHO: VISUALIZACIÓN Y RESULTADOS */}
        <div className="lg:w-2/3 flex flex-col gap-4 min-w-0">
          {imageSrc ? (
            <>
              {/* CANVAS DE PREVISUALIZACIÓN */}
              <div className="bg-slate-100 rounded-2xl p-2 sm:p-4 border border-slate-200 flex justify-center items-center overflow-hidden h-44 sm:h-64 shadow-inner relative">
                <canvas 
                  ref={canvasRef} 
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm bg-white"
                />
              </div>

              {/* RESULTADOS DEL ANÁLISIS */}
              {results.length > 0 ? (
                <div className="space-y-4">
                  {/* 4 Métricas de Área Claras */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Área 1 Toalla</p>
                      <p className="text-base sm:text-lg font-black text-emerald-800 font-mono">
                        {((widthCm / 100) * (heightCm / 100)).toFixed(3)} <span className="text-xs font-bold text-emerald-600">m²</span>
                      </p>
                      <p className="text-[9px] text-emerald-600 font-mono">{widthCm}×{heightCm}cm</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Área Total ({piezasPorGolpe} pz)</p>
                      <p className="text-base sm:text-lg font-black text-slate-800 font-mono">
                        {((widthCm / 100) * (heightCm / 100) * piezasPorGolpe).toFixed(3)} <span className="text-xs font-bold text-slate-400">m²</span>
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">Golpe completo</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-blue-600 uppercase">Área Estampada</p>
                      <p className="text-base sm:text-lg font-black text-blue-700 font-mono">
                        {results.reduce((acc, r) => acc + ((widthCm / 100) * (heightCm / 100) * piezasPorGolpe * (r.percentage / 100)), 0).toFixed(3)} <span className="text-xs font-bold text-blue-400">m²</span>
                      </p>
                      <p className="text-[9px] text-blue-400 font-mono">Con tinta</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Fondo sin Tinta</p>
                      <p className="text-base sm:text-lg font-black text-amber-700 font-mono">
                        {Math.max(0, (((widthCm / 100) * (heightCm / 100) * piezasPorGolpe) - results.reduce((acc, r) => acc + ((widthCm / 100) * (heightCm / 100) * piezasPorGolpe * (r.percentage / 100)), 0))).toFixed(3)} <span className="text-xs font-bold text-amber-400">m²</span>
                      </p>
                      <p className="text-[9px] text-amber-400 font-mono">En blanco</p>
                    </div>
                  </div>

                  {/* Lista de Marcos Detectados */}
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span>Separación de Marcos ({results.length} Colores)</span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Auto-mapeado</span>
                    </h3>

                    <div className="grid gap-2.5 sm:gap-3">
                      {results.map((color, idx) => (
                        <div key={idx} className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                          {/* Fila principal del marco */}
                          <div className="p-3 flex items-center gap-3">
                            {/* Muestra de color */}
                            <div 
                              className="w-10 h-10 rounded-xl shadow-inner border border-black/10 shrink-0" 
                              style={{ backgroundColor: color.hex }}
                            />

                            {/* Info y Selector de Pantone */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm truncate">
                                  Marco {idx + 1}
                                  <span className="text-slate-400 font-mono font-normal ml-1.5 text-[11px]">({color.hex})</span>
                                </h4>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-mono font-black text-slate-800">{color.percentage.toFixed(1)}%</span>
                                  <span className="text-[10px] font-mono text-blue-600 font-bold ml-1.5 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {color.areaM2.toFixed(3)} m²
                                  </span>
                                </div>
                              </div>

                              <div className="mt-1.5">
                                <select 
                                  value={mappedPantones[idx] || ''}
                                  onChange={(e) => setMappedPantones(prev => ({ ...prev, [idx]: e.target.value }))}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none truncate"
                                >
                                  <option value="">Selecciona Pantone...</option>
                                  {pantones.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Barra de progreso de cobertura */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.min(100, color.percentage)}%`, backgroundColor: color.hex }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Previsualización del fotolito aislado */}
                          <div className="bg-slate-50/80 p-2 sm:p-3 flex justify-center items-center border-t border-slate-100" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
                            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden max-h-28 sm:max-h-36 flex justify-center shadow-2xs">
                              <img 
                                src={color.previewUrl} 
                                alt={`Separación ${color.hex}`} 
                                className="max-h-28 sm:max-h-36 object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        <strong>Tip:</strong> Los porcentajes calculados se pueden guardar como un nuevo <em>Diseño</em> para la fábrica o utilizarlos directamente en la <em>Calculadora de Mezclas</em>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
                  {analyzing ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-slate-600">Analizando millones de píxeles...</p>
                    </div>
                  ) : (
                    <p className="text-xs font-medium">Presiona "Recalcular" para procesar el diseño.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Estado Inicial: Sin Imagen */
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl sm:rounded-3xl bg-slate-50/50 p-6 sm:p-12 text-center">
              <Droplets className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Sin diseño cargado</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Sube una imagen del fotolito o arte final para analizar las separaciones de color y extraer el área exacta de cobertura de cada marco.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
