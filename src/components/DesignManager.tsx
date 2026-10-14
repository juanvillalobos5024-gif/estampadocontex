import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Palette, Trash2, Edit2, Loader2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Design, PantoneColor } from '../types';
import { addDesign, getDesigns, deleteDesign, updateDesign, syncDesignToProductionRecords, isToallaDesign } from '../lib/dataService';

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
  const [gramaje, setGramaje] = useState<number | ''>('');
  const [unitWeight, setUnitWeight] = useState<number | ''>('');
  const [productType, setProductType] = useState<'Toallas' | 'Otros'>('Toallas');
  const [lineType, setLineType] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [colors, setColors] = useState<{ pantoneCode: string; gramsPerPiece: number }[]>([{ pantoneCode: '', gramsPerPiece: 10 }]);

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
      const isToalla = isToallaDesign(normName) || (productType === 'Toallas' && lineType === 'pigmento');

      const widthCm = isToalla ? 35 : (existing?.widthCm || 60);
      const heightCm = isToalla ? 60 : (existing?.heightCm || 120);
      const piezasPorGolpe = isToalla ? 5 : (existing?.piezasPorGolpe || 3);
      const gVal = isToalla ? 310 : (gramaje !== '' && !isNaN(Number(gramaje)) ? Number(gramaje) : (existing?.gramaje || 280));
      const wVal = isToalla ? 63 : (unitWeight !== '' && !isNaN(Number(unitWeight)) ? Number(unitWeight) : (existing?.unitWeight || 201.6));
      const calcAreaTowel = isToalla ? 0.21 : (gVal > 0 && wVal > 0 ? (wVal / gVal) : Number(((widthCm * heightCm) / 10000).toFixed(2)));
      const calcAreaTotal = calcAreaTowel * piezasPorGolpe;

      const designData = {
        name: normName,
        imageUrl,
        frames: Number(frames) || 0,
        gramaje: gVal,
        unitWeight: wVal,
        widthCm,
        heightCm,
        piezasPorGolpe,
        areaPorToalla: calcAreaTowel,
        areaTotal: calcAreaTotal,
        productType,
        lineType: isToalla ? 'pigmento' : lineType,
        colors: colors.filter(c => c.pantoneCode && c.gramsPerPiece > 0)
      };

      if (editingDesignId) {
        await updateDesign(editingDesignId, designData);
      } else {
        await addDesign(designData);
      }

      // Sincronizar automáticamente registros de producción para que nunca queden desactualizados
      await syncDesignToProductionRecords(normName, wVal, gVal, widthCm, heightCm, piezasPorGolpe);

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

  if (isCreating) {
    return (
      <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {editingDesignId ? 'Editar Diseño / Referencia' : 'Crear Nuevo Diseño Multi-Color'}
          </h2>
          <button onClick={handleCancel} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
            Cancelar
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre del Diseño / Arte</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Toalla Iron Man"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Imagen (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {imageUrl && <img src={imageUrl} alt="Preview" className="mt-3 h-24 object-contain rounded-lg border border-slate-200 shadow-sm" />}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cantidad de Marcos</label>
                  <input 
                    type="number" 
                    value={frames}
                    onChange={e => setFrames(Number(e.target.value))}
                    min="0"
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g/pz</span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const gVal = gramaje !== '' ? Number(gramaje) : 0;
                  const wVal = unitWeight !== '' ? Number(unitWeight) : 0;
                  const area = gVal > 0 && wVal > 0 ? (wVal / gVal) : 0.72;
                  const total = area * 3;
                  return (
                    <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs font-mono flex justify-between items-center text-blue-900">
                      <span>Área x Toalla: <strong className="font-bold text-blue-800">{area.toFixed(3)} m²</strong> (60×120 cm)</span>
                      <span>Área Total (3 pz): <strong className="font-bold text-blue-800">{total.toFixed(3)} m²</strong></span>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Toallas">Toallas</option>
                  <option value="Otros">Otros</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Línea</label>
                <select 
                  value={lineType}
                  onChange={e => setLineType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pigmento">Pigmentos (Pigmentos)</option>
                  <option value="reactivo">Reactivo</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Colores Requeridos</label>
                  {colors.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-mono">
                      Total: {colors.reduce((sum, c) => sum + (Number(c.gramsPerPiece) || 0), 0).toFixed(2)} g/pz
                      {unitWeight !== '' && Number(unitWeight) > 0 && (
                        <span className="text-slate-500 font-normal ml-1">
                          ({((colors.reduce((sum, c) => sum + (Number(c.gramsPerPiece) || 0), 0) / Number(unitWeight)) * 100).toFixed(1)}% prenda)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button type="button" onClick={handleAddColor} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800">
                  <Plus className="w-3 h-3" /> Añadir Color
                </button>
              </div>
              
              <div className="space-y-3">
                {colors.map((c, idx) => (
                  <div key={idx} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <select 
                        value={c.pantoneCode}
                        onChange={e => handleColorChange(idx, 'pantoneCode', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecciona un Color Pantone...</option>
                        {pantones.map(p => (
                          <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <input 
                          type="number"
                          step="any"
                          min="0.01"
                          value={c.gramsPerPiece}
                          onChange={e => handleColorChange(idx, 'gramsPerPiece', Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          required
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">g/pz</span>
                      </div>
                    </div>
                    {colors.length > 1 && (
                      <button type="button" onClick={() => handleRemoveColor(idx)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-all shadow-md mt-4">
              {editingDesignId ? 'Actualizar Diseño' : 'Guardar Diseño'}
            </button>
          </form>
        </div>
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
      {zoomedData && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 cursor-pointer backdrop-blur-sm"
          onClick={() => setZoomedData(null)}
        >
          <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl backdrop-blur-md transition-colors" title="Cerrar (Esc)">
            <span className="text-xs font-semibold">Cerrar</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Esc</span>
            <X className="w-4 h-4 ml-1" />
          </div>

          {zoomedData.title && (
            <div className="mb-4 text-white text-xl font-bold flex items-center gap-3">
              {zoomedData.color && (
                <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: zoomedData.color }} />
              )}
              {zoomedData.title}
            </div>
          )}
          <img src={zoomedData.url} className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" alt="Zoomed" />
        </div>
      )}
    </div>
  );
}
