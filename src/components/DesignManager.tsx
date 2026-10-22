import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Palette, Trash2, Edit2, Loader2, AlertCircle, X, ChevronLeft, ChevronRight, ZoomIn, UploadCloud, Calculator, Check, ChevronDown } from 'lucide-react';
import { Design, PantoneColor } from '../types';
import { addDesign, getDesigns, deleteDesign, updateDesign, syncDesignToProductionRecords, isToallaDesign } from '../lib/dataService';
import PantoneSearchableSelect from './PantoneSearchableSelect';
import { AnalyzedColor, analyzeImageSource, calculateInkGrams } from '../lib/imageColorAnalysis';

interface DesignManagerProps {
  pantones: PantoneColor[];
  onRefreshDesigns?: () => void;
}

export default function DesignManager({ pantones, onRefreshDesigns }: DesignManagerProps) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [zoomedData, setZoomedData] = useState<{url: string; title?: string; color?: string} | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [frames, setFrames] = useState<number>(0);
  const [widthCm, setWidthCm] = useState<number | ''>(60);
  const [heightCm, setHeightCm] = useState<number | ''>(120);
  const [piezasPorGolpe, setPiezasPorGolpe] = useState<number | ''>(3);
  const [gramaje, setGramaje] = useState<number | ''>('');
  const [unitWeight, setUnitWeight] = useState<number | ''>('');
  const [productType, setProductType] = useState<'Toallas' | 'Otros'>('Toallas');
  const [lineType, setLineType] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [colors, setColors] = useState<{ pantoneCode: string; gramsPerPiece: number; previewUrl?: string }[]>([{ pantoneCode: '', gramsPerPiece: 10 }]);

  // Análisis automático del arte (marcos + Pantones) — reutiliza src/lib/imageColorAnalysis.ts
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalyzedColor[] | null>(null);
  const [analysisMapping, setAnalysisMapping] = useState<Record<number, string>>({}); // idx de marco -> código Pantone
  const [analysisPxg, setAnalysisPxg] = useState<number>(3);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisTolerance, setAnalysisTolerance] = useState<number>(30);
  const [analysisMinCoverage, setAnalysisMinCoverage] = useState<number>(1.5);
  const [analysisVolumen, setAnalysisVolumen] = useState<number>(15);

  const loadDesigns = async () => {
    setLoading(true);
    const data = await getDesigns();
    setDesigns(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDesigns();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Manejo de la tecla Escape (Esc) para cerrar imagen ampliada y formularios
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedData) {
          setZoomedData(null);
        } else if (isCreating) {
          setIsCreating(false);
        } else if (editingDesignId) {
          setEditingDesignId(null);
        }
      }
    };

    if (zoomedData) {
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (zoomedData) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [zoomedData, isCreating, editingDesignId]);

  const handleAddColor = () => {
    setColors([...colors, { pantoneCode: '', gramsPerPiece: 10 }]);
  };

  const handleColorChange = (index: number, field: 'pantoneCode' | 'gramsPerPiece', value: any) => {
    const newColors = [...colors];
    newColors[index] = { ...newColors[index], [field]: value };
    setColors(newColors);
  };

  const handleRemoveColor = (index: number) => {
    const newColors = colors.filter((_, i) => i !== index);
    setColors(newColors);
  };

  // Si cambia/quita la imagen, los resultados del análisis anterior dejan de ser válidos
  useEffect(() => {
    setAnalysisResults(null);
    setAnalysisError(null);
  }, [imageUrl]);

  const getAnalysisParams = () => {
    const wCm = widthCm !== '' && Number(widthCm) > 0 ? Number(widthCm) : 60;
    const hCm = heightCm !== '' && Number(heightCm) > 0 ? Number(heightCm) : 120;
    const pxg = piezasPorGolpe !== '' && Number(piezasPorGolpe) > 0
      ? Number(piezasPorGolpe)
      : (wCm <= 40 ? 5 : 3);
    return { wCm, hCm, pxg };
  };

  const handleAnalyzeArt = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResults(null);

    try {
      const { wCm, hCm, pxg } = getAnalysisParams();
      const results = await analyzeImageSource(imageUrl, pantones, {
        widthCm: wCm,
        heightCm: hCm,
        piezasPorGolpe: pxg,
        tolerance: analysisTolerance,
        minCoverage: analysisMinCoverage,
        includeWhitePadding: true
      });

      // Pre-asigna el Pantone más cercano del catálogo a cada marco detectado
      const mapping: Record<number, string> = {};
      results.forEach((r, i) => {
        if (r.closestPantoneCode) mapping[i] = r.closestPantoneCode;
      });

      setAnalysisPxg(pxg);
      setAnalysisMapping(mapping);
      setAnalysisResults(results);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err?.message || 'No se pudo analizar la imagen.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyAnalysis = () => {
    if (!analysisResults) return;

    const applied = analysisResults
      .map((r, idx) => {
        const code = analysisMapping[idx];
        if (!code) return null;
        const grams = calculateInkGrams(r.areaM2 / analysisPxg, analysisVolumen);
        return {
          pantoneCode: code,
          gramsPerPiece: Math.max(0.01, Number(grams.toFixed(2))),
          previewUrl: r.previewUrl
        };
      })
      .filter((c): c is { pantoneCode: string; gramsPerPiece: number; previewUrl: string } => c !== null);

    if (applied.length === 0) {
      alert('Asigna al menos un Pantone a los marcos detectados para poder aplicarlos.');
      return;
    }

    const hasExisting = colors.some(c => c.pantoneCode);
    if (hasExisting && !window.confirm(`Esto reemplazará los ${colors.length} color(es) actuales por ${applied.length} marco(s) detectado(s). ¿Continuar?`)) {
      return;
    }

    setColors(applied);
    setFrames(applied.length);
    setAnalysisResults(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 800;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Fill background with white in case of transparent PNGs converted to JPEG
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              setImageUrl(compressedBase64);
            } else {
              setImageUrl(reader.result as string); // Fallback
            }
          } catch (err) {
            console.error("Error compressing image:", err);
            setImageUrl(reader.result as string); // Fallback
          }
        };
        img.onerror = () => {
          alert("Hubo un error al leer la imagen. Puede que el formato no sea compatible (ej. HEIC de iPhone). Intenta con un JPG o PNG.");
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = (d: Design) => {
    setName(d.name);
    setImageUrl(d.imageUrl || '');
    setFrames(d.frames || 0);
    setWidthCm(d.widthCm !== undefined && d.widthCm !== null ? d.widthCm : 60);
    setHeightCm(d.heightCm !== undefined && d.heightCm !== null ? d.heightCm : 120);
    setPiezasPorGolpe(d.piezasPorGolpe !== undefined && d.piezasPorGolpe !== null ? d.piezasPorGolpe : 3);
    setGramaje(d.gramaje !== undefined && d.gramaje !== null ? d.gramaje : '');
    setUnitWeight(d.unitWeight !== undefined && d.unitWeight !== null ? d.unitWeight : '');
    setProductType(d.productType || 'Toallas');
    setLineType(d.lineType || 'pigmento');
    setColors(d.colors && d.colors.length > 0 ? d.colors : [{ pantoneCode: '', gramsPerPiece: 10 }]);
    setEditingDesignId(d.id || null);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingDesignId(null);
    setName('');
    setImageUrl('');
    setFrames(0);
    setWidthCm(60);
    setHeightCm(120);
    setPiezasPorGolpe(3);
    setGramaje('');
    setUnitWeight('');
    setProductType('Toallas');
    setLineType('pigmento');
    setColors([{ pantoneCode: '', gramsPerPiece: 10 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || colors.some(c => !c.pantoneCode || c.gramsPerPiece <= 0)) {
      alert("Por favor completa todos los campos correctamente.");
      return;
    }

    try {
      const existing = designs.find(d => d.id === editingDesignId);
      const normName = name.toUpperCase().trim();

      const wCm = widthCm !== '' && !isNaN(Number(widthCm)) && Number(widthCm) > 0
        ? Number(widthCm)
        : (existing?.widthCm || 60);
      const hCm = heightCm !== '' && !isNaN(Number(heightCm)) && Number(heightCm) > 0
        ? Number(heightCm)
        : (existing?.heightCm || 120);
      const pxg = piezasPorGolpe !== '' && !isNaN(Number(piezasPorGolpe)) && Number(piezasPorGolpe) > 0
        ? Number(piezasPorGolpe)
        : (existing?.piezasPorGolpe || (wCm <= 40 ? 5 : 3));

      const calcAreaTowel = Number(((wCm * hCm) / 10000).toFixed(3));
      const calcAreaTotal = Number((calcAreaTowel * pxg).toFixed(3));

      const gVal = gramaje !== '' && !isNaN(Number(gramaje)) && Number(gramaje) > 0
        ? Number(gramaje)
        : (unitWeight !== '' && Number(unitWeight) > 0 && calcAreaTowel > 0
          ? Number((Number(unitWeight) / calcAreaTowel).toFixed(1))
          : (existing?.gramaje || 280));

      const wVal = unitWeight !== '' && !isNaN(Number(unitWeight)) && Number(unitWeight) > 0
        ? Number(unitWeight)
        : (calcAreaTowel > 0 && gVal > 0
          ? Number((calcAreaTowel * gVal).toFixed(1))
          : (existing?.unitWeight || 201.6));

      const designData: Design = {
        name: normName,
        imageUrl,
        frames: Number(frames) || 0,
        gramaje: gVal,
        unitWeight: wVal,
        widthCm: wCm,
        heightCm: hCm,
        piezasPorGolpe: pxg,
        areaPorToalla: calcAreaTowel,
        areaTotal: calcAreaTotal,
        productType,
        lineType,
        colors: colors.filter(c => c.pantoneCode && c.gramsPerPiece > 0)
      };

      if (editingDesignId) {
        await updateDesign(editingDesignId, designData);
      } else {
        await addDesign(designData);
      }

      // Sincronizar automáticamente registros de producción para que nunca queden desactualizados
      await syncDesignToProductionRecords(normName, wVal, gVal, wCm, hCm, pxg);

      handleCancel();
      loadDesigns();
      if (onRefreshDesigns) onRefreshDesigns();
    } catch (err) {
      console.error(err);
      alert("Error al guardar el diseño.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este diseño?")) {
      await deleteDesign(id);
      loadDesigns();
      if (onRefreshDesigns) onRefreshDesigns();
    }
  };

  const normalizeSearchText = (text: string) => {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const filteredDesigns = useMemo(() => {
    const q = normalizeSearchText(searchTerm);
    if (!q) return designs;

    const queryWords = q.split(/\s+/).filter(Boolean);

    return designs.filter(d => {
      const nameNorm = normalizeSearchText(d.name);
      const productNorm = normalizeSearchText(d.productType);
      const lineNorm = normalizeSearchText(d.lineType);
      const colorCodes = (d.colors || []).map(c => normalizeSearchText(c.pantoneCode)).join(' ');

      const combinedText = `${nameNorm} ${productNorm} ${lineNorm} ${colorCodes}`;

      return queryWords.every(word => combinedText.includes(word));
    });
  }, [designs, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDesigns.length / itemsPerPage));

  const paginatedDesigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDesigns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDesigns, currentPage, itemsPerPage]);

  const renderZoomModal = () => {
    if (!zoomedData) return null;
    return (
      <div 
        className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-6 cursor-pointer backdrop-blur-md animate-fade-in"
        onClick={() => setZoomedData(null)}
      >
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl backdrop-blur-md transition-colors cursor-pointer" title="Cerrar (Esc)">
          <span className="text-xs font-semibold">Cerrar</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Esc</span>
          <X className="w-4 h-4 ml-1" />
        </div>

        {zoomedData.title && (
          <div className="mb-4 text-white text-base sm:text-xl font-bold flex items-center gap-3 text-center px-4 max-w-xl">
            {zoomedData.color && (
              <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg shrink-0" style={{ backgroundColor: zoomedData.color }} />
            )}
            <span className="truncate">{zoomedData.title}</span>
          </div>
        )}
        <img 
          src={zoomedData.url} 
          className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
          alt="Zoomed" 
          onClick={e => e.stopPropagation()}
        />
      </div>
    );
  };

  if (isCreating) {
    return (
      <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {editingDesignId ? 'Editar Diseño / Referencia' : 'Crear Nuevo Diseño Multi-Color'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura las especificaciones técnicas, arte y consumo de tintas por golpe
            </p>
          </div>
          <button 
            type="button"
            onClick={handleCancel} 
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre del Diseño / Arte</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. TOALLA STICH NIÑO"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {/* Sección de Imagen con Previsualización Interactiva y Ampliable */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Arte / Imagen del Diseño
                </label>
                {!imageUrl ? (
                  <label className="relative border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[170px] group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Seleccionar imagen o arte</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG o WEBP (Diseño del estampado)</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div 
                      onClick={() => setZoomedData({ url: imageUrl, title: name || 'Arte del Diseño' })}
                      className="relative h-44 sm:h-48 w-full rounded-2xl border-2 border-slate-200 bg-slate-900/5 overflow-hidden flex items-center justify-center p-2.5 cursor-pointer group hover:border-blue-400 transition-all shadow-xs"
                      title="Clic para ampliar diseño en tamaño completo"
                    >
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="max-h-full max-w-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-105" 
                      />
                      
                      {/* Overlay táctil de ampliar */}
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white font-bold text-xs backdrop-blur-[2px]">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                        <span>Clic para ampliar arte</span>
                      </div>

                      <div className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1.5 shadow-sm group-hover:opacity-0 transition-opacity">
                        <ZoomIn className="w-3 h-3 text-blue-300" />
                        <span>Ampliar</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1.5 min-h-[36px] py-1">
                        <UploadCloud className="w-3.5 h-3.5" /> Cambiar imagen
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1 min-h-[36px] py-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Quitar arte
                      </button>
                    </div>

                    {/* Reutiliza el analizador de visión: detecta marcos y sugiere Pantones */}
                    <button
                      type="button"
                      onClick={handleAnalyzeArt}
                      disabled={analyzing}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                      title="Escanea el arte para separar los marcos por color y sugerir el Pantone de cada uno"
                    >
                      {analyzing && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{analyzing ? 'Analizando arte...' : 'Analizar marcos y Pantones'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Medidas y Parámetros */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cantidad de Marcos</label>
                    <input 
                      type="number" 
                      value={frames}
                      onChange={e => setFrames(Number(e.target.value))}
                      min="0"
                      placeholder="0"
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Piezas x Golpe</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={piezasPorGolpe}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                          setPiezasPorGolpe(val);
                        }}
                        min="1"
                        placeholder="Ej. 3 o 5"
                        className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">pz</span>
                    </div>
                  </div>
                </div>

                {/* Medidas: Ancho y Largo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                      <span>Ancho</span>
                      <span className="text-[10px] text-blue-600 font-normal">cm</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="any"
                        min="1"
                        value={widthCm}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          const num = val === '' ? '' : parseFloat(val);
                          setWidthCm(num);
                          if (typeof num === 'number' && num > 0) {
                            if (num <= 40 && piezasPorGolpe === 3) setPiezasPorGolpe(5);
                            else if (num > 40 && piezasPorGolpe === 5) setPiezasPorGolpe(3);
                          }
                        }}
                        placeholder="Ej. 60"
                        className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                      <span>Largo / Alto</span>
                      <span className="text-[10px] text-blue-600 font-normal">cm</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="any"
                        min="1"
                        value={heightCm}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          setHeightCm(val === '' ? '' : parseFloat(val));
                        }}
                        placeholder="Ej. 120"
                        className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gramaje (Tela)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        value={gramaje}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          setGramaje(val === '' ? '' : parseFloat(val));
                        }}
                        placeholder="Ej. 280"
                        className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-12 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">g/m²</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Peso x Unidad</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        value={unitWeight}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          setUnitWeight(val === '' ? '' : parseFloat(val));
                        }}
                        placeholder="Ej. 201.6"
                        className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g/pz</span>
                    </div>
                  </div>
                </div>

                {/* Panel de Superficies y Áreas Calculadas en Máquina (Diseño Tipo Tarjeta Industrial) */}
                {(() => {
                  const wCm = widthCm !== '' && !isNaN(Number(widthCm)) ? Number(widthCm) : 0;
                  const hCm = heightCm !== '' && !isNaN(Number(heightCm)) ? Number(heightCm) : 0;
                  const gVal = gramaje !== '' && !isNaN(Number(gramaje)) ? Number(gramaje) : 0;
                  const wVal = unitWeight !== '' && !isNaN(Number(unitWeight)) ? Number(unitWeight) : 0;
                  const pxg = piezasPorGolpe !== '' && Number(piezasPorGolpe) > 0 
                    ? Number(piezasPorGolpe) 
                    : (wCm > 0 && wCm <= 40 ? 5 : 3);
                  
                  const areaFromDim = (wCm > 0 && hCm > 0) ? (wCm * hCm) / 10000 : 0;
                  const area = areaFromDim > 0 ? areaFromDim : (gVal > 0 && wVal > 0 ? (wVal / gVal) : 0.72);
                  const total = area * pxg;
                  const dimStr = (wCm > 0 && hCm > 0) ? `${wCm}×${hCm} cm` : '60×120 cm';
                  
                  return (
                    <div className="bg-gradient-to-br from-blue-50 via-indigo-50/40 to-slate-50 p-3.5 sm:p-4 rounded-2xl border border-blue-200/90 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-blue-600" />
                          Cálculo de Área en Estampado
                        </span>
                        <span className="text-[10px] font-bold bg-white text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-mono shadow-2xs">
                          {dimStr}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Tarjeta 1: Área por Toalla */}
                        <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-xs flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Área por Toalla
                            </span>
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                          </div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-xl sm:text-2xl font-black font-mono text-slate-800 tracking-tight">
                              {area.toFixed(3)}
                            </span>
                            <span className="text-xs font-bold text-blue-600 font-mono">m²</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            1 unidad ({dimStr})
                          </span>
                        </div>

                        {/* Tarjeta 2: Área Total Golpe */}
                        <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-xs flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                              Área Total Golpe
                            </span>
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          </div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-900 tracking-tight">
                              {total.toFixed(3)}
                            </span>
                            <span className="text-xs font-bold text-indigo-600 font-mono">m²</span>
                          </div>
                          <span className="text-[10px] text-indigo-600/80 font-bold mt-0.5">
                            {pxg} piezas / ciclo de máquina
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Producto</label>
                <select 
                  value={productType}
                  onChange={e => setProductType(e.target.value as any)}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Toallas">Toallas</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Línea Técnica</label>
                <select 
                  value={lineType}
                  onChange={e => setLineType(e.target.value as any)}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pigmento">Pigmentos (Estampado Pigmento)</option>
                  <option value="reactivo">Reactivo (Estampado Reactivo)</option>
                </select>
              </div>
            </div>

            {/* Resultado del análisis automático del arte: marcos detectados + Pantone sugerido */}
            {(analyzing || analysisError || analysisResults) && (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 sm:p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    
                    Análisis de marcos y Pantones
                  </span>
                  {!analyzing && (
                    <button
                      type="button"
                      onClick={() => { setAnalysisResults(null); setAnalysisError(null); }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
                      title="Descartar análisis"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {analyzing && (
                  <div className="flex items-center gap-3 py-4 justify-center text-blue-700">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold">Escaneando píxeles y separando colores...</span>
                  </div>
                )}

                {analysisError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{analysisError}</span>
                  </div>
                )}

                {analysisResults && analysisResults.length === 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                    No se detectaron marcos en la imagen. Prueba bajando el <strong>filtro de ruido</strong> o subiendo la <strong>tolerancia</strong> en la calibración avanzada.
                  </div>
                )}

                {analysisResults && analysisResults.length > 0 && (() => {
                  const mappedCount = analysisResults.filter((_, i) => !!analysisMapping[i]).length;
                  const unmapped = analysisResults.length - mappedCount;
                  return (
                    <>
                      <p className="text-[11px] sm:text-xs text-slate-600">
                        Se detectaron <strong className="text-blue-800">{analysisResults.length} marcos</strong>. El Pantone se sugiere por cercanía de color; corrígelo si hace falta antes de aplicar.
                      </p>

                      <div className="space-y-2.5">
                        {analysisResults.map((r, idx) => {
                          const code = analysisMapping[idx] || '';
                          const gramsPz = calculateInkGrams(r.areaM2 / analysisPxg, analysisVolumen);
                          return (
                            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row gap-2.5 sm:gap-3 sm:items-center shadow-2xs">
                              <div className="flex items-center gap-2.5 sm:w-52 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setZoomedData({ url: r.previewUrl, title: `Marco ${idx + 1} · ${r.hex}`, color: r.hex })}
                                  className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 cursor-pointer hover:border-blue-400 transition-colors"
                                  style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '6px 6px' }}
                                  title="Ver separación de este marco"
                                >
                                  <img src={r.previewUrl} alt={`Marco ${idx + 1}`} className="w-full h-full object-contain" />
                                </button>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0" style={{ backgroundColor: r.hex }} />
                                    <span className="text-xs font-black text-slate-800">Marco {idx + 1}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {r.hex} · {r.percentage.toFixed(1)}%
                                  </p>
                                  <p className="text-[10px] text-blue-700 font-bold font-mono">
                                    ≈ {gramsPz.toFixed(1)} g/pz
                                  </p>
                                </div>
                              </div>

                              <div className="flex-1 min-w-0">
                                <PantoneSearchableSelect
                                  pantones={pantones}
                                  value={code}
                                  onChange={(c) => setAnalysisMapping(prev => ({ ...prev, [idx]: c }))}
                                  placeholder={r.closestPantoneName ? `Sugerido: ${r.closestPantoneName}` : 'Sin coincidencia — busca un Pantone...'}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {unmapped > 0 && (
                        <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {unmapped} marco(s) sin Pantone asignado se omitirán al aplicar.
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={handleApplyAnalysis}
                          disabled={mappedCount === 0}
                          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="w-4 h-4" />
                          Aplicar {mappedCount} marco(s) al diseño
                        </button>
                        <button
                          type="button"
                          onClick={handleAnalyzeArt}
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          
                          Re-analizar
                        </button>
                      </div>
                    </>
                  );
                })()}

                {/* Calibración avanzada (misma que el Analizador de Separación) */}
                <details className="group bg-white/80 rounded-xl border border-slate-200">
                  <summary className="p-2.5 text-xs font-bold text-slate-600 flex items-center justify-between cursor-pointer select-none min-h-[40px]">
                    <span>Calibración avanzada</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[9px] text-blue-700 bg-blue-50 font-bold px-1.5 py-0.5 rounded">
                        Tol: {analysisTolerance} · Ruido: {analysisMinCoverage}% · Vol: {analysisVolumen}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
                    </span>
                  </summary>
                  <div className="p-3 border-t border-slate-100 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Tolerancia de color</span>
                        <span className="font-bold text-blue-600 font-mono">{analysisTolerance}</span>
                      </div>
                      <input type="range" min="5" max="100" value={analysisTolerance} onChange={e => setAnalysisTolerance(Number(e.target.value))} className="w-full accent-blue-600" />
                      <p className="text-[10px] text-slate-400">Fusiona variaciones del mismo tono (antialiasing).</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Filtro de ruido (mínimo %)</span>
                        <span className="font-bold text-blue-600 font-mono">{analysisMinCoverage}%</span>
                      </div>
                      <input type="range" min="0.1" max="5" step="0.1" value={analysisMinCoverage} onChange={e => setAnalysisMinCoverage(Number(e.target.value))} className="w-full accent-blue-600" />
                      <p className="text-[10px] text-slate-400">Ignora tonos que cubran menos de este % del área.</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Volumen teórico (cm³/m²)</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={analysisVolumen}
                        onChange={e => setAnalysisVolumen(Number(e.target.value) || 15)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400">Se usa para estimar los gramos de tinta por pieza de cada marco.</p>
                    </div>
                    <p className="text-[10px] text-slate-400">Después de cambiar la calibración, pulsa “Re-analizar” o “Analizar marcos y Pantones”.</p>
                  </div>
                </details>
              </div>
            )}

            {/* Gestión y Selección de Colores (Pantone con Buscador Predictivo y Muestra de Color) */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Colores / Marcos Requeridos ({colors.length})
                  </label>
                  {colors.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono">
                      Total: {colors.reduce((sum, c) => sum + (Number(c.gramsPerPiece) || 0), 0).toFixed(2)} g/pz
                      {unitWeight !== '' && Number(unitWeight) > 0 && (
                        <span className="text-slate-500 font-normal ml-1">
                          ({((colors.reduce((sum, c) => sum + (Number(c.gramsPerPiece) || 0), 0) / Number(unitWeight)) * 100).toFixed(1)}% prenda)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={handleAddColor} 
                  className="min-h-[42px] px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Añadir Color
                </button>
              </div>
              
              <div className="space-y-3">
                {colors.map((c, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    {/* Indicador de Marco */}
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-200/80 text-slate-700 text-xs font-black font-mono flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase sm:hidden">
                        Marco #{idx + 1}
                      </span>
                    </div>

                    {/* Selector de Pantone Predictivo con Swatch de Color */}
                    <div className="flex-1 min-w-0">
                      <PantoneSearchableSelect
                        pantones={pantones}
                        value={c.pantoneCode}
                        onChange={(code) => handleColorChange(idx, 'pantoneCode', code)}
                        placeholder="Buscar por código (ej: 185 C) o nombre..."
                        required
                      />
                    </div>

                    {/* Consumo en Gramos por Pieza */}
                    <div className="flex items-center gap-2">
                      <div className="w-full sm:w-36">
                        <div className="relative">
                          <input 
                            type="number"
                            step="any"
                            min="0.01"
                            value={c.gramsPerPiece}
                            onChange={e => handleColorChange(idx, 'gramsPerPiece', Number(e.target.value))}
                            className="w-full min-h-[44px] bg-white border border-slate-200 rounded-xl px-3 py-2 pr-12 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="Gramos"
                            required
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g/pz</span>
                        </div>
                      </div>

                      {/* Botón Eliminar Color con Touch Target Grande (>= 44px) */}
                      {colors.length > 1 ? (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveColor(idx)} 
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 border border-red-100 active:scale-95 transition-all cursor-pointer shrink-0"
                          title="Eliminar este color / marco"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="w-11 h-11 shrink-0 hidden sm:block" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full min-h-[50px] bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-2xl py-3.5 text-sm sm:text-base font-bold transition-all shadow-md mt-6 cursor-pointer flex items-center justify-center gap-2"
            >
              {editingDesignId ? 'Actualizar Diseño' : 'Guardar Diseño'}
            </button>
          </form>
        </div>

        {/* Modal de Imagen Ampliada accesible desde el formulario */}
        {renderZoomModal()}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, producto, color o tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
            {filteredDesigns.length} Diseño{filteredDesigns.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Diseño
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col justify-between">
        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
            {searchTerm ? (
              <>
                <Search className="w-12 h-12 mb-3 text-slate-300" />
                <p className="font-semibold text-base text-slate-600">No se encontraron diseños para "{searchTerm}"</p>
                <p className="text-xs text-slate-400 mt-1">Intenta con otro término, tono Pantone o limpia la búsqueda.</p>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpiar búsqueda
                </button>
              </>
            ) : (
              <>
                <Palette className="w-16 h-16 mb-4 text-slate-300" />
                <p className="font-medium text-lg text-slate-500">No hay diseños creados</p>
                <p className="text-sm">Agrega el primer arte multi-color para empezar.</p>
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedDesigns.map(design => (
              <div key={design.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{design.name}</h3>
                    <p className="text-xs font-semibold text-slate-500 flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="bg-slate-100 px-2 py-1 rounded-md">{design.productType}</span>
                      <span className={`px-2 py-1 rounded-md text-white ${design.lineType === 'reactivo' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                        {design.lineType === 'reactivo' ? 'Reactivo' : 'Pigmentos'}
                      </span>
                      {design.widthCm && design.heightCm ? (
                        <span className="bg-sky-50 text-sky-800 border border-sky-200 font-bold px-2 py-1 rounded-md font-mono">
                          {design.widthCm}×{design.heightCm} cm
                        </span>
                      ) : null}
                      {design.frames !== undefined && design.frames > 0 && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                          {design.frames} Marco{design.frames !== 1 && 's'}
                        </span>
                      )}
                      {design.gramaje !== undefined && design.gramaje > 0 && (
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded-md">
                          {design.gramaje} g/m²
                        </span>
                      )}
                      {design.unitWeight !== undefined && design.unitWeight > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-md">
                          Peso: {design.unitWeight}g
                        </span>
                      )}
                      {(() => {
                        const areaTowel = design.areaPorToalla || (design.widthCm && design.heightCm ? (design.widthCm * design.heightCm) / 10000 : (design.unitWeight && design.gramaje ? design.unitWeight / design.gramaje : 0.72));
                        return (
                          <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-md">
                            Área: {areaTowel.toFixed(2)} m²
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(design)} className="text-slate-300 hover:text-blue-500 transition-colors p-1">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => design.id && handleDelete(design.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {design.imageUrl && (
                  <div 
                    className="mt-3 mb-3 h-32 w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center p-2 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setZoomedData({ url: design.imageUrl!, title: design.name })}
                  >
                    <img src={design.imageUrl} alt={design.name} className="max-h-full max-w-full object-contain rounded-md shadow-sm" />
                  </div>
                )}
                
                {/* Panel explícito de Gramajes y Pesos */}
                {(() => {
                  const totalInk = design.colors.reduce((a, b) => a + (b.gramsPerPiece || 0), 0);
                  const hasUnitWeight = design.unitWeight !== undefined && design.unitWeight > 0;
                  const inkPercentage = hasUnitWeight ? ((totalInk / design.unitWeight!) * 100).toFixed(1) : null;
                  
                  return (
                    <div className="space-y-2 mt-3">
                      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Gramaje Tela</span>
                          <div className="mt-0.5">
                            <span className={`font-mono font-black text-sm ${design.gramaje && design.gramaje > 0 ? 'text-slate-800' : 'text-slate-400 text-xs italic'}`}>
                              {design.gramaje && design.gramaje > 0 ? `${design.gramaje} g/m²` : '—'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Peso Prenda</span>
                          <div className="mt-0.5">
                            <span className={`font-mono font-black text-sm ${hasUnitWeight ? 'text-emerald-700' : 'text-slate-400 text-xs italic'}`}>
                              {hasUnitWeight ? `${design.unitWeight} g` : '—'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tinta / Pz</span>
                          <div className="mt-0.5">
                            <span className="font-mono font-black text-blue-700 text-sm">
                              {totalInk.toFixed(2)} g
                            </span>
                            {inkPercentage && (
                              <span className="text-[9px] font-bold text-blue-600 block">
                                ({inkPercentage}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Panel de Áreas explícitas */}
                      {(() => {
                        const piezasGolpe = design.piezasPorGolpe || 3;
                        const areaTowel = design.areaPorToalla || (design.widthCm && design.heightCm ? (design.widthCm * design.heightCm) / 10000 : (design.unitWeight && design.gramaje ? design.unitWeight / design.gramaje : 0.72));
                        const areaTotal = design.areaTotal || (areaTowel * piezasGolpe);
                        
                        return (
                          <div className="grid grid-cols-2 gap-2 p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-blue-500 block tracking-wider">Área por Toalla</span>
                              <div className="mt-0.5">
                                <span className="font-mono font-black text-sm text-blue-900">
                                  {areaTowel.toFixed(3)} m²
                                </span>
                                <span className="text-[10px] text-blue-600/70 block font-mono">
                                  {design.widthCm && design.heightCm ? `${design.widthCm}×${design.heightCm} cm` : '60×120 cm (1 pz)'}
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-blue-500 block tracking-wider">Área Total ({piezasGolpe} toallas)</span>
                              <div className="mt-0.5">
                                <span className="font-mono font-black text-sm text-blue-900">
                                  {areaTotal.toFixed(3)} m²
                                </span>
                                <span className="text-[10px] text-blue-600/70 block font-mono">
                                  Golpe de máquina
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
                
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                    <span>Colores ({design.colors.length})</span>
                    <span className="text-blue-600 font-mono font-bold">
                      Total: {design.colors.reduce((a, b) => a + (b.gramsPerPiece || 0), 0).toFixed(2)} g/pz
                    </span>
                  </div>
                  <div className="space-y-1">
                    {design.colors.map((c, i) => {
                      const pantone = pantones.find(p => p.code === c.pantoneCode);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-inner shrink-0" style={{ backgroundColor: pantone?.hex || '#ccc' }} />
                            <span className="font-semibold text-slate-700">{c.pantoneCode}</span>
                            {c.previewUrl && (
                              <img 
                                src={c.previewUrl} 
                                alt="Marco" 
                                className="w-6 h-6 object-contain bg-slate-100 rounded border border-slate-200 shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform ml-1" 
                                onClick={() => setZoomedData({ url: c.previewUrl!, title: c.pantoneCode, color: pantone?.hex || '#ccc' })}
                              />
                            )}
                          </div>
                          <span className="font-bold text-slate-500">{c.gramsPerPiece}g / pz</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

            {/* Barra de Paginación */}
            {filteredDesigns.length > 0 && (
              <div className="mt-8 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-medium">
                    Mostrando <strong className="text-slate-800">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredDesigns.length)}</strong> a <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredDesigns.length)}</strong> de <strong className="text-slate-800">{filteredDesigns.length}</strong> diseños
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-[11px] font-semibold text-slate-400">Por página:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                    >
                      <option value={6}>6</option>
                      <option value={9}>9</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-none hover:shadow-sm"
                      title="Primera página"
                    >
                      «
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-none hover:shadow-sm"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Botones de número de página */}
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          return (
                            <div key={p} className="flex items-center">
                              {prev && p - prev > 1 && (
                                <span className="text-slate-400 text-xs px-1">...</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setCurrentPage(p)}
                                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentPage === p
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-white hover:text-blue-600'
                                }`}
                              >
                                {p}
                              </button>
                            </div>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-none hover:shadow-sm"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-none hover:shadow-sm"
                      title="Última página"
                    >
                      »
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Imagen Ampliada */}
      {renderZoomModal()}
    </div>
  );
}
