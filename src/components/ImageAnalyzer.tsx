import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, BarChart3, Droplets, AlertTriangle } from 'lucide-react';

import { PantoneColor, Design } from '../types';

interface ColorData {
  hex: string;
  rgb: [number, number, number];
  pixelCount: number;
  percentage: number;
  areaM2: number;
  previewUrl: string; // <-- Nueva propiedad para la previsualización del marco
  closestPantoneId?: string;
  closestPantoneName?: string;
}

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
  const [tolerance, setTolerance] = useState<number>(30); // Tolerancia para agrupar colores similares
  const [minCoverage, setMinCoverage] = useState<number>(1.5); // % mínimo de cobertura para considerar un marco válido
  const [includeWhitePadding, setIncludeWhitePadding] = useState<boolean>(true); // Asignar blancos al fondo
  const [mappedPantones, setMappedPantones] = useState<Record<number, string>>({}); // index -> pantoneId
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setResults([]);
    }
  };

  // Función para calcular distancia euclidiana entre dos colores RGB
  const colorDistance = (c1: [number, number, number], c2: [number, number, number]) => {
    return Math.sqrt(
      Math.pow(c1[0] - c2[0], 2) + 
      Math.pow(c1[1] - c2[1], 2) + 
      Math.pow(c1[2] - c2[2], 2)
    );
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  const analyzeImage = () => {
    if (!imageSrc || !canvasRef.current) return;
    
    setAnalyzing(true);
    
    setTimeout(() => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const totalPixels = canvas.width * canvas.height;
      const totalAreaM2 = (widthCm / 100) * (heightCm / 100) * piezasPorGolpe; // Área de TODO EL GOLPE

      const colorGroups: { rgb: [number, number, number], count: number }[] = [];
      let whitePixelsCount = 0;

      const step = 4;
      for (let i = 0; i < data.length; i += step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 50) continue;
        if (r > 240 && g > 240 && b > 240) {
          if (includeWhitePadding) {
            whitePixelsCount++;
          }
          continue;
        }

        const pixelColor: [number, number, number] = [r, g, b];
        
        let foundGroup = false;
        for (let j = 0; j < colorGroups.length; j++) {
          if (colorDistance(colorGroups[j].rgb, pixelColor) < tolerance) {
            colorGroups[j].count++;
            colorGroups[j].rgb[0] = Math.round((colorGroups[j].rgb[0] * colorGroups[j].count + r) / (colorGroups[j].count + 1));
            colorGroups[j].rgb[1] = Math.round((colorGroups[j].rgb[1] * colorGroups[j].count + g) / (colorGroups[j].count + 1));
            colorGroups[j].rgb[2] = Math.round((colorGroups[j].rgb[2] * colorGroups[j].count + b) / (colorGroups[j].count + 1));
            foundGroup = true;
            break;
          }
        }

        if (!foundGroup) {
          colorGroups.push({ rgb: pixelColor, count: 1 });
        }
      }

      colorGroups.sort((a, b) => b.count - a.count);
      
      if (includeWhitePadding && whitePixelsCount > 0 && colorGroups.length > 0) {
        colorGroups[0].count += whitePixelsCount;
      }

      const mainGroup = colorGroups[0]; // El color de fondo (usualmente)

      // El umbral se define por el usuario (por defecto 1.5%)
      const minPixelsThreshold = totalPixels * (minCoverage / 100); 
      const validGroups = colorGroups.filter(group => group.count >= minPixelsThreshold);
      
      const analyzedColors: ColorData[] = validGroups.map(group => {
        const percentage = (group.count / totalPixels) * 100;
        
        // --- Generar la representación del marco (Separación) ---
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d')!;
        const tImageData = tCtx.createImageData(canvas.width, canvas.height);
        
        const isMainGroup = (group === mainGroup);

        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          const isWhite = r > 240 && g > 240 && b > 240;
          
          if (a >= 50 && (colorDistance(group.rgb, [r, g, b]) < tolerance || (includeWhitePadding && isWhite && isMainGroup))) {
            tImageData.data[i] = r;
            tImageData.data[i+1] = g;
            tImageData.data[i+2] = b;
            tImageData.data[i+3] = 255;
          } else {
            tImageData.data[i+3] = 0;
          }
        }
        tCtx.putImageData(tImageData, 0, 0);
        const previewUrl = tempCanvas.toDataURL();

        // --- Descifrar Pantone más cercano ---
        let closestPantoneId: string | undefined;
        let closestPantoneName: string | undefined;
        let minDistance = Infinity;

        pantones.forEach(p => {
          if (!p.hex) return;
          const pRgb = hexToRgb(p.hex);
          const dist = colorDistance(group.rgb, pRgb);
          // Podemos definir un umbral máximo, pero por ahora solo tomamos el más cercano
          if (dist < minDistance && dist < 80) { // Si la distancia es muy grande, tal vez no coincide
            minDistance = dist;
            closestPantoneId = p.id;
            closestPantoneName = `${p.code} - ${p.name}`;
          }
        });

        return {
          hex: rgbToHex(group.rgb[0], group.rgb[1], group.rgb[2]),
          rgb: group.rgb,
          pixelCount: group.count,
          percentage: percentage,
          areaM2: totalAreaM2 * (percentage / 100),
          previewUrl: previewUrl,
          closestPantoneId,
          closestPantoneName
        };
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

  // Efecto para inicializar mappedPantones si hay resultados y no están mapeados
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

  // Efecto para dibujar la imagen en el canvas cuando se carga
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
  const [designProductType, setDesignProductType] = useState<'Toallas' | 'Otros' | 'Otros'>('Toallas');
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
      setUnitWeight(65.1);
      setPiezasPorGolpe(5);
      setDesignLineType('pigmento');
      setDesignProductType('Toallas');
    }
  };

  const handleOpenSaveModal = () => {
    setDesignName('');
    setShowSaveModal(true);
  };

  const calculateGrams = (areaM2: number) => {
    // Constantes de consumo
    const k_trans = 0.85;
    const rho = 1.05;
    const gramos = (areaM2 * 10000) * (volumenTeorico / 10000) * k_trans * rho;
    return gramos * 1.10; // 10% merma
  };

  const handleSaveConfirm = () => {
    if (!designName.trim()) return alert("Debe ingresar un nombre para el diseño");
    
    // Validar que todos los colores detectados tengan un pantone asignado
    for (let i = 0; i < results.length; i++) {
      if (!mappedPantones[i]) {
        return alert(`Debe asignar un color Pantone al Marco ${i + 1}`);
      }
    }

    const designColors = results.map((r, idx) => {
      const pId = mappedPantones[idx];
      const p = pantones.find(x => x.id === pId);
      // r.areaM2 es el área del golpe completo. La dividimos entre piezasPorGolpe para guardar los gramos POR PIEZA
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
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
      
      {/* Modal de Guardado */}
      {showSaveModal && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto border border-slate-200 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Guardar como Nuevo Diseño</h2>
              <p className="text-sm text-slate-500 mt-1">Asigna un color del catálogo a cada marco detectado y guarda la receta.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="pigmento">Pigmentos (Pigmentos)</option>
                  <option value="reactivo">Colorantes Reactivos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Producto</label>
                <select 
                  value={designProductType}
                  onChange={e => setDesignProductType(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Toallas">Toallas</option>
                  <option value="Otros">Otros</option>
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
                    className="w-full p-2.5 pr-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Volumen Teórico (cm³/m²)</label>
                <input 
                  type="number" 
                  value={volumenTeorico}
                  onChange={e => setVolumenTeorico(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Mapeo de Colores</h3>
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="w-8 h-8 rounded shadow-sm border border-black/10 shrink-0" style={{ backgroundColor: r.hex }} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">Marco {idx + 1} ({r.percentage.toFixed(1)}%)</p>
                    <select
                      value={mappedPantones[idx] || ''}
                      onChange={e => setMappedPantones(prev => ({...prev, [idx]: e.target.value}))}
                      className="w-full mt-1 p-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Seleccionar Color Pantone del Catálogo --</option>
                      {pantones.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Consumo por Pieza</p>
                    <p className="font-mono text-sm font-black text-blue-700">{calculateGrams(r.areaM2 / piezasPorGolpe).toFixed(1)} g</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveConfirm} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md">
                Guardar Diseño Definitivo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-blue-400" />
            Computer Vision: Análisis de Separación
          </h2>
          <p className="text-sm text-slate-400 mt-1">Escanea los píxeles del diseño para calcular la cobertura exacta por marco.</p>
        </div>
        {results.length > 0 && (
          <button 
            onClick={handleOpenSaveModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg"
          >
            Guardar como Diseño
          </button>
        )}
      </div>

      <div className="p-6 flex flex-col lg:flex-row gap-8 overflow-y-auto">
        
        {/* Panel Izquierdo: Carga y Opciones */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Dimensiones Físicas (Prenda)</h3>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Plantilla Rápida</label>
              <select 
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="custom">Personalizado</option>
                <option value="kids">Toallas Línea Kids (60x120, Reactivo, 280g)</option>
                <option value="cocina">Toallas de Cocina (35x60, Pigmento, 310g)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ancho (cm)</label>
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
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Alto (cm)</label>
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
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Piezas por Golpe</label>
                <input 
                  type="number" 
                  value={piezasPorGolpe} 
                  onChange={(e) => { setPiezasPorGolpe(Number(e.target.value)); setPreset('custom'); }}
                  min="1"
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Gramaje Tela (g/m²)</label>
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
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>Peso por Unidad (g / pz)</span>
                <span className="text-[10px] text-blue-600 font-semibold uppercase">Prenda / Toalla</span>
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  value={unitWeight} 
                  onChange={(e) => { 
                    const w = Number(e.target.value);
                    setUnitWeight(w); 
                    const area = (widthCm * heightCm) / 10000;
                    if (area > 0) {
                      setGramaje(Number((w / area).toFixed(1)));
                    }
                    setPreset('custom'); 
                  }}
                  placeholder="Ej. 201.6"
                  className="w-full p-2.5 pr-12 rounded-xl border-2 border-blue-200 bg-white text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500">g/pz</span>
              </div>
              <p className="text-[10px] text-blue-600/80 mt-1.5 flex justify-between font-mono">
                <span>Área: {((widthCm * heightCm) / 10000).toFixed(3)} m²/pz</span>
                <span>{gramaje} g/m²</span>
              </p>
            </div>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Tolerancia de Color</span>
                  <span className="text-blue-600 font-bold">{tolerance}</span>
                </label>
                <input 
                  type="range" 
                  min="5" max="100" 
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ajusta para fusionar variaciones del mismo color (antialiasing).</p>
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Filtro de Ruido (Umbral %)</span>
                  <span className="text-amber-600 font-bold">{minCoverage}%</span>
                </label>
                <input 
                  type="range" 
                  min="0.1" max="5" step="0.1"
                  value={minCoverage}
                  onChange={(e) => setMinCoverage(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ignora colores que cubran menos de este % del área. Súbelo para borrar marcos falsos.</p>
              </div>

              <label className="flex items-start gap-3 mt-4 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={includeWhitePadding}
                  onChange={(e) => setIncludeWhitePadding(e.target.checked)}
                  className="mt-0.5 accent-blue-600 w-4 h-4 rounded border-slate-300"
                />
                <div>
                  <p className="text-xs font-bold text-slate-700">Asignar márgenes blancos al fondo</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    El sistema detectará el color dominante (usualmente el fondo) y le sumará automáticamente todo el espacio blanco vacío de la imagen. Ideal para fotolitos con bordes blancos.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors group">
            <Upload className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-sm font-bold text-blue-700">Subir Fotolito / Diseño</span>
            <span className="text-xs text-blue-500/70 mt-1">JPG, PNG (Transparente ideal)</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>

          {imageSrc && (
            <button 
              onClick={analyzeImage}
              disabled={analyzing}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {analyzing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Procesando millones de píxeles...</>
              ) : (
                <><BarChart3 className="w-4 h-4" /> Recalcular Áreas</>
              )}
            </button>
          )}
        </div>

        {/* Panel Derecho: Visualización y Resultados */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          {imageSrc ? (
            <>
              {/* Canvas Preview */}
              <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 flex justify-center items-center overflow-hidden h-64 shadow-inner">
                <canvas 
                  ref={canvasRef} 
                  className="max-h-full object-contain rounded-lg shadow-sm bg-white" // Fondo blanco por defecto para canvas
                />
              </div>

              {/* Resultados */}
              {results.length > 0 ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Área por Toalla</p>
                      <p className="text-xl font-black text-emerald-800">
                        {((widthCm / 100) * (heightCm / 100)).toFixed(3)} <span className="text-sm font-bold text-emerald-600">m²</span>
                      </p>
                      <p className="text-[10px] text-emerald-600 font-mono mt-0.5">{widthCm} × {heightCm} cm (1 pz)</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Área Total ({piezasPorGolpe} pz)</p>
                      <p className="text-xl font-black text-slate-800">
                        {((widthCm / 100) * (heightCm / 100) * piezasPorGolpe).toFixed(3)} <span className="text-sm font-bold text-slate-400">m²</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Golpe completo</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-blue-500 uppercase mb-1">Área Estampado</p>
                      <p className="text-xl font-black text-blue-700">
                        {results.reduce((acc, r) => acc + ((widthCm / 100) * (heightCm / 100) * piezasPorGolpe * (r.percentage / 100)), 0).toFixed(3)} <span className="text-sm font-bold text-blue-400">m²</span>
                      </p>
                      <p className="text-[10px] text-blue-400 font-mono mt-0.5">Todos los marcos</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-amber-500 uppercase mb-1">Espacio Fondo</p>
                      <p className="text-xl font-black text-amber-700">
                        {(((widthCm / 100) * (heightCm / 100) * piezasPorGolpe) - results.reduce((acc, r) => acc + ((widthCm / 100) * (heightCm / 100) * piezasPorGolpe * (r.percentage / 100)), 0)).toFixed(3)} <span className="text-sm font-bold text-amber-400">m²</span>
                      </p>
                      <p className="text-[10px] text-amber-400 font-mono mt-0.5">Sin tinta</p>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-3">Separación de Marcos Detectada</h3>
                  <div className="grid gap-3">
                    {results.map((color, idx) => (
                      <div key={idx} className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center p-3 border-b border-slate-100">
                          <div 
                            className="w-12 h-12 rounded-lg shadow-sm border border-black/10 shrink-0" 
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="ml-4 flex-1">
                            <h4 className="font-bold text-slate-800 text-sm">
                              Marco Color {idx + 1} 
                              <span className="text-slate-400 font-normal ml-1">({color.hex})</span>
                            </h4>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Color Real:</span>
                              <select 
                                value={mappedPantones[idx] || ''}
                                onChange={(e) => setMappedPantones(prev => ({ ...prev, [idx]: e.target.value }))}
                                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="">Selecciona Pantone...</option>
                                {pantones.map(p => (
                                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, color.percentage)}%`, backgroundColor: color.hex }}
                              />
                            </div>
                          </div>
                          <div className="ml-6 flex gap-6 text-right">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">% Cobertura</p>
                              <p className="font-mono font-bold text-lg text-slate-700">{color.percentage.toFixed(2)}%</p>
                            </div>
                            <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                              <p className="text-[10px] text-blue-600 uppercase font-bold">Área a Estampar</p>
                              <p className="font-mono font-black text-lg text-blue-700">{color.areaM2.toFixed(3)} <span className="text-xs">m²</span></p>
                            </div>
                          </div>
                        </div>
                        {/* Representación Gráfica del Fotolito/Separación */}
                        <div className="bg-slate-50 p-4 flex justify-center items-center border-t border-slate-100 pattern-dots" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
                          <div className="relative border border-slate-200 rounded shadow-sm bg-white overflow-hidden max-h-40 flex justify-center">
                            <img 
                              src={color.previewUrl} 
                              alt={`Separación ${color.hex}`} 
                              className="max-h-40 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800">
                      <strong>Tip:</strong> Puedes ingresar estos porcentajes directamente en la <em>Calculadora de Consumos</em> del detalle de tu fórmula. 
                      Los colores con menos del 0.5% de cobertura han sido ignorados (considerados ruido de imagen).
                    </p>
                  </div>
                </div>
              ) : !analyzing && imageSrc && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <p>Presiona "Recalcular Áreas" para procesar el diseño.</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 p-12 text-center">
              <Droplets className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Sin diseño cargado</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-2">Sube una imagen del fotolito o arte final para analizar las separaciones de color y extraer el área exacta de cobertura.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
