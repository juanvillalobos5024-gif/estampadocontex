import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { PantoneColor, StockItem, BatchLog, TeamMember, WorkOrder, Design, DailyProductionRecord } from '../types';
import { INITIAL_EXCEL_DESIGNS, FULL_YEAR_PRODUCTION_RECORDS } from './initialProductionData';
import { SALIDA_INSUMOS_RECORDS } from './salidaInsumosData';
import inventoryData from '../inventory_data.json';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Colecciones en Firestore
const PANTONES_COLLECTION = 'pantones';
const STOCK_COLLECTION = 'stock';
const BATCHES_COLLECTION = 'batches';
const TEAM_COLLECTION = 'team';
const WORK_ORDERS_COLLECTION = 'work_orders';
const DESIGNS_COLLECTION = 'designs';
const PRODUCTION_RECORDS_COLLECTION = 'production_records';

// Datos de semilla iniciales (Seeds)
const INITIAL_PANTONES: PantoneColor[] = [
  {
    code: '185 C',
    name: 'Rojo Vibrante Corporativo',
    hex: '#E21933',
    mesh: '90 hilos',
    squeegee: '75 Shore',
    notes: 'Recordar aplicar pre-secado de 3 segundos entre capas para toalla de rizo largo.',
    formulas: [
      { component: 'Base Clear 001', description: 'Resina transparente textil', percentage: 82.5 },
      { component: 'Red Pigment RV', description: 'Pigmento concentrado rojo', percentage: 14.2 },
      { component: 'White Matte 05', description: 'Opacador para toalla oscura', percentage: 2.8 },
      { component: 'Fixer F-10', description: 'Aditivo de anclaje (Lavado)', percentage: 0.5 }
    ]
  },
  {
    code: '286 C',
    name: 'Azul Marino Toalla Playa',
    hex: '#0033A0',
    mesh: '62 hilos',
    squeegee: '70 Shore',
    notes: 'Uso ideal en toallas de playa premium. Mantener viscosidad fluida para una excelente penetración en felpa de toalla.',
    formulas: [
      { component: 'Base Clear 001', description: 'Resina transparente textil', percentage: 78.0 },
      { component: 'Blue Pigment BL', description: 'Pigmento azul cobalto', percentage: 16.5 },
      { component: 'Black Pigment BK', description: 'Pigmento negro de ajuste', percentage: 1.5 },
      { component: 'White Matte 05', description: 'Opacador para toalla oscura', percentage: 3.0 },
      { component: 'Fixer F-10', description: 'Aditivo de anclaje (Lavado)', percentage: 1.0 }
    ]
  },
  {
    code: '360 C',
    name: 'Verde Hamaca Jardín',
    hex: '#78BE20',
    mesh: '62 hilos',
    squeegee: '65 Shore',
    notes: 'Base altamente elástica requerida para evitar grietas al estirar los hilos de la hamaca de algodón.',
    formulas: [
      { component: 'Elastic Base EB-10', description: 'Base copolímero ultra elástica', percentage: 85.0 },
      { component: 'Yellow Pigment YE', description: 'Pigmento amarillo brillante', percentage: 11.2 },
      { component: 'Blue Pigment BL', description: 'Pigmento azul cobalto', percentage: 3.0 },
      { component: 'Fixer F-10', description: 'Aditivo de anclaje (Lavado)', percentage: 0.8 }
    ]
  },
  {
    code: '021 C',
    name: 'Naranja Logos Publicitarios',
    hex: '#FE5000',
    mesh: '90 hilos',
    squeegee: '75 Shore',
    notes: 'Requiere doble pasada (estampa-presecado-estampa) si se aplica sobre toalla azul o negra.',
    formulas: [
      { component: 'Base Clear 001', description: 'Resina transparente textil', percentage: 80.0 },
      { component: 'Orange Pigment OR', description: 'Pigmento naranja puro', percentage: 15.0 },
      { component: 'Yellow Pigment YE', description: 'Pigmento amarillo brillante', percentage: 4.0 },
      { component: 'Fixer F-10', description: 'Aditivo de anclaje (Lavado)', percentage: 1.0 }
    ]
  },
  {
    code: 'TURQUESA R',
    name: 'Turquesa Reactivo Toalla Rizo',
    hex: '#00A3E0',
    mesh: '62 hilos',
    squeegee: '70 Shore',
    notes: 'Línea Reactiva. Estampación reactiva para felpa de toalla. Requiere fijación por vapor húmedo a 102°C por 8 minutos y lavado posterior.',
    formulas: [
      { component: 'Pasta Espesante Alginato de Sodio', description: 'Pasta espesante base agua reactivos', percentage: 88.0 },
      { component: 'Azul Reactivo H-EXL', description: 'Colorante reactivo azul turquesa', percentage: 8.0 },
      { component: 'Urea Auxiliar Textil', description: 'Aditivo higroscópico retenedor de humedad', percentage: 3.0 },
      { component: 'Carbonato de Sodio (Fijador)', description: 'Aditivo fijador alcalino', percentage: 1.0 }
    ]
  }
];

const INITIAL_STOCK: StockItem[] = inventoryData as StockItem[];

const INITIAL_TEAM: TeamMember[] = [
  { name: 'Jorge Martínez', role: 'Jefe de Estampado', active: true },
  { name: 'Enoc Chatelain', role: 'Líder de Color / Pigmentos', active: true },
  { name: 'Mateo Gómez', role: 'Prensista de Toallas', active: true },
  { name: 'Santiago Ruiz', role: 'Operario de Mezclado', active: true },
  { name: 'Camila Ríos', role: 'Auxiliar de Laboratorio', active: true }
];

const SEED_DEMO_BATCHES: BatchLog[] = [
  {
    pantoneCode: '185 C',
    pantoneHex: '#E21933',
    productType: 'Toallas',
    quantity: 500,
    totalGrammage: 1000,
    operator: 'Santiago Ruiz',
    timestamp: Timestamp.fromDate(new Date(Date.now() - 3600000 * 2)), // hace 2 horas
    status: 'Completado'
  },
  {
    pantoneCode: '360 C',
    pantoneHex: '#78BE20',
    productType: 'Otros',
    quantity: 120,
    totalGrammage: 1500,
    operator: 'Camila Ríos',
    timestamp: Timestamp.fromDate(new Date(Date.now() - 3600000 * 8)), // hace 8 horas
    status: 'Completado'
  },
  {
    pantoneCode: '286 C',
    pantoneHex: '#0033A0',
    productType: 'Toallas',
    quantity: 350,
    totalGrammage: 800,
    operator: 'Mateo Gómez',
    timestamp: Timestamp.fromDate(new Date(Date.now() - 3600000 * 18)), // hace 18 horas
    status: 'Completado'
  }
];

/**
 * Seed database with initial structure if it is empty
 */
export async function seedDatabaseIfEmpty() {
  try {
    // Corregir nombre de Eduardo a Enoc en el equipo si ya existe en la base de datos
    const teamSnap = await getDocs(collection(db, TEAM_COLLECTION));
    for (const d of teamSnap.docs) {
      const data = d.data();
      if (data.name === 'Eduardo Chatelain') {
        const docRef = doc(db, TEAM_COLLECTION, d.id);
        await updateDoc(docRef, { name: 'Enoc Chatelain' });
        console.log('Se corrigió el nombre de Eduardo a Enoc en Firestore.');
      }
    }

    // CLEANUP: Eliminar insumos duplicados en inventario
    const stockSnapForCleanup = await getDocs(collection(db, STOCK_COLLECTION));
    const seenNames = new Set<string>();
    const duplicateIds: string[] = [];
    stockSnapForCleanup.docs.forEach(d => {
      const data = d.data();
      const nameKey = data.name?.trim().toLowerCase();
      if (nameKey) {
        if (seenNames.has(nameKey)) {
          duplicateIds.push(d.id);
        } else {
          seenNames.add(nameKey);
        }
      }
    });
    for (const dupId of duplicateIds) {
      await deleteDoc(doc(db, STOCK_COLLECTION, dupId));
      console.log(`Se eliminó insumo duplicado: ${dupId}`);
    }

    const pantoneSnap = await getDocs(collection(db, PANTONES_COLLECTION));
    if (pantoneSnap.empty) {
      console.log('Base de datos vacía. Sembrando datos iniciales en Firestore...');
      
      // Seed Pantones
      for (const pantone of INITIAL_PANTONES) {
        await addDoc(collection(db, PANTONES_COLLECTION), {
          ...pantone,
          createdAt: serverTimestamp()
        });
      }
      
      // Seed Stock
      for (const item of INITIAL_STOCK) {
        await addDoc(collection(db, STOCK_COLLECTION), {
          ...item,
          lastUpdated: serverTimestamp()
        });
      }

      // Seed Team
      for (const member of INITIAL_TEAM) {
        await addDoc(collection(db, TEAM_COLLECTION), member);
      }

      // Seed Batches
      for (const batch of SEED_DEMO_BATCHES) {
        await addDoc(collection(db, BATCHES_COLLECTION), batch);
      }
      
      console.log('¡Siembra de base de datos completada con éxito!');
    } else {
      console.log('La base de datos ya contiene registros. Saltando siembra general.');
      // Chequear si ya existen los insumos reactivos, si no, agregarlos de forma incremental
      const stockSnap = await getDocs(collection(db, STOCK_COLLECTION));
      const hasReactivo = stockSnap.docs.some(d => {
        const data = d.data();
        return data.category === 'reactivo' || data.type === 'colorante_reactivo' || data.type === 'pasta';
      });
      if (!hasReactivo) {
        console.log('Detectada base de datos existente sin insumos reactivos. Agregando insumos reactivos...');
        const reactivosToSeed = INITIAL_STOCK.filter(item => item.category === 'reactivo');
        for (const item of reactivosToSeed) {
          await addDoc(collection(db, STOCK_COLLECTION), {
            ...item,
            lastUpdated: serverTimestamp()
          });
        }
        
        // También agregar la muestra reactiva en Pantone si no está
        const hasTurquesa = pantoneSnap.docs.some(d => d.data().code === 'TURQUESA R');
        if (!hasTurquesa) {
          const turquesaColor = INITIAL_PANTONES.find(p => p.code === 'TURQUESA R');
          if (turquesaColor) {
            await addDoc(collection(db, PANTONES_COLLECTION), {
              ...turquesaColor,
              createdAt: serverTimestamp()
            });
          }
        }
      }

      // Sembrar los diseños estándar de la producción en Firestore si faltan
      try {
        const designsSnap = await getDocs(collection(db, DESIGNS_COLLECTION));
        const existingNames = new Set(designsSnap.docs.map(d => (d.data().name || '').toUpperCase().trim()));
        for (const d of INITIAL_DESIGNS) {
          if (!existingNames.has(d.name.toUpperCase().trim())) {
            await addDoc(collection(db, DESIGNS_COLLECTION), {
              ...d,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.warn('Error al verificar/sembrar diseños:', err);
      }
    }
  } catch (error) {
    console.error('Error al sembrar base de datos:', error);
  }
}

// --- PANTONES CRUD ---

export async function getPantoneColors(limitCount?: number): Promise<PantoneColor[]> {
  try {
    let q = query(collection(db, PANTONES_COLLECTION), orderBy('code'));
    if (limitCount) {
      q = query(collection(db, PANTONES_COLLECTION), orderBy('code'), limit(limitCount));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as PantoneColor[];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, PANTONES_COLLECTION);
    return [];
  }
}

export async function addPantoneColor(pantone: PantoneColor): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PANTONES_COLLECTION), {
      ...pantone,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PANTONES_COLLECTION);
    throw error;
  }
}

export async function updatePantoneColor(id: string, pantone: Partial<PantoneColor>): Promise<void> {
  try {
    const docRef = doc(db, PANTONES_COLLECTION, id);
    await updateDoc(docRef, pantone);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PANTONES_COLLECTION}/${id}`);
  }
}

export async function deletePantoneColor(id: string): Promise<void> {
  try {
    const docRef = doc(db, PANTONES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PANTONES_COLLECTION}/${id}`);
  }
}

// --- STOCK CRUD ---

export async function getStockItems(): Promise<StockItem[]> {
  try {
    const snap = await getDocs(collection(db, STOCK_COLLECTION));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as StockItem[];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, STOCK_COLLECTION);
    return [];
  }
}

export async function updateStockItemQuantity(id: string, newQuantity: number): Promise<void> {
  try {
    const docRef = doc(db, STOCK_COLLECTION, id);
    await updateDoc(docRef, {
      quantity: Math.max(0, newQuantity),
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${STOCK_COLLECTION}/${id}`);
  }
}

export async function updateStockItem(id: string, item: Partial<StockItem>): Promise<void> {
  try {
    const docRef = doc(db, STOCK_COLLECTION, id);
    await updateDoc(docRef, {
      ...item,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${STOCK_COLLECTION}/${id}`);
  }
}

export async function deleteStockItem(id: string): Promise<void> {
  try {
    const docRef = doc(db, STOCK_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${STOCK_COLLECTION}/${id}`);
  }
}

/**
 * Suscripción en tiempo real a inventario y stock de insumos
 */
export function subscribeToStock(onUpdate: (stock: StockItem[]) => void): () => void {
  try {
    const unsubscribe = onSnapshot(collection(db, STOCK_COLLECTION), (snap) => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as StockItem[];
      onUpdate(items);
    }, (error) => {
      console.warn('Error en listener tiempo real de Stock:', error);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('No se pudo suscribir a Stock:', error);
    return () => {};
  }
}

/**
 * Sincroniza el inventario con los datos del reporte de inventario Excel más reciente.
 * - Actualiza las cantidades de los insumos existentes a los gramos físicos del Excel.
 * - Crea los insumos nuevos que no existían.
 * - Pone en 0 gramos los insumos que no figuran en el archivo ("las que no esten dejalas en 0").
 */
export async function syncInventoryWithExcel(excelItems: any[]): Promise<{ updated: number; added: number; zeroed: number }> {
  let updated = 0;
  let added = 0;
  let zeroed = 0;

  try {
    const currentStock = await getStockItems();
    const matchedStockIds = new Set<string>();

    for (const item of excelItems) {
      if (!item.name) continue;
      
      const match = currentStock.find(s => 
        s.name.trim().toLowerCase() === item.name.trim().toLowerCase() ||
        (item.ref && s.name.trim().toLowerCase() === item.ref.trim().toLowerCase())
      ) || findMatchingStockItem(currentStock, item.name) || (item.ref ? findMatchingStockItem(currentStock, item.ref) : undefined);

      if (match && match.id) {
        matchedStockIds.add(match.id);
        const docRef = doc(db, STOCK_COLLECTION, match.id);
        await updateDoc(docRef, {
          quantity: item.quantity,
          type: item.type || match.type,
          category: item.category || match.category,
          hexColor: item.hexColor || match.hexColor,
          lastUpdated: serverTimestamp()
        });
        updated++;
      } else {
        const docRef = await addDoc(collection(db, STOCK_COLLECTION), {
          name: item.name,
          type: item.type,
          category: item.category,
          quantity: item.quantity,
          minRequired: item.minRequired || 5000,
          hexColor: item.hexColor,
          lastUpdated: serverTimestamp()
        });
        matchedStockIds.add(docRef.id);
        added++;
      }
    }

    // Regla: "las que no estén déjalas en 0"
    for (const stockItem of currentStock) {
      if (stockItem.id && !matchedStockIds.has(stockItem.id)) {
        if (stockItem.quantity !== 0) {
          const docRef = doc(db, STOCK_COLLECTION, stockItem.id);
          await updateDoc(docRef, {
            quantity: 0,
            lastUpdated: serverTimestamp()
          });
          zeroed++;
        }
      }
    }

    console.log(`Sincronización de inventario completada: ${updated} actualizados, ${added} creados, ${zeroed} en 0.`);
  } catch (error) {
    console.error('Error al sincronizar inventario:', error);
  }

  return { updated, added, zeroed };
}

/**
 * Busca de forma flexible e inteligente el insumo de stock que corresponde
 * a un componente de fórmula (maneja variaciones como "ROJO REACTIVO" vs "ROJO REACTIVO ME 6BL",
 * diferencias de mayúsculas/minúsculas, espacios, guiones, etc.)
 */
export function findMatchingStockItem(stock: StockItem[], componentName: string): StockItem | undefined {
  if (!componentName || !stock || stock.length === 0) return undefined;
  
  const rawComp = componentName.trim();
  const lowerComp = rawComp.toLowerCase();

  // 1. Coincidencia exacta
  const exact = stock.find(s => s.name === rawComp) || stock.find(s => s.name.trim().toLowerCase() === lowerComp);
  if (exact) return exact;

  // Normalizador de texto: quita signos de puntuación, puntos, guiones y espacios dobles
  const normalize = (str: string) => 
    str.toLowerCase()
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .replace(/[\-_•.,/\\()[\]]/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();

  const normComp = normalize(componentName);
  if (!normComp) return undefined;

  // 2. Coincidencia exacta normalizada
  const normExact = stock.find(s => normalize(s.name) === normComp);
  if (normExact) return normExact;

  // 3. Coincidencia de prefijo (e.g. Stock "ROJO REACTIVO ME 6BL" comienza con "ROJO REACTIVO") o viceversa
  const prefixMatch = stock.find(s => {
    const normStock = normalize(s.name);
    return normStock.startsWith(normComp) || normComp.startsWith(normStock);
  });
  if (prefixMatch) return prefixMatch;

  // 4. Subcadena completa
  const substringMatch = stock.find(s => {
    const normStock = normalize(s.name);
    return normStock.includes(normComp) || normComp.includes(normStock);
  });
  if (substringMatch) return substringMatch;

  // 5. Coincidencia por palabras clave (todas las palabras del componente contenidas en el stock)
  const words = normComp.split(' ').filter(w => w.length > 1);
  if (words.length > 0) {
    const allWordsMatch = stock.find(s => {
      const normStock = normalize(s.name);
      return words.every(w => normStock.includes(w));
    });
    if (allWordsMatch) return allWordsMatch;
  }

  return undefined;
}

/**
 * Busca un color Pantone comparando de forma normalizada (sin espacios, mayúsculas)
 * Ej. "185 C" coincide con "185C"
 */
export function findMatchingPantone(pantones: PantoneColor[], code: string): PantoneColor | undefined {
  if (!code || !pantones || pantones.length === 0) return undefined;
  const clean = (c: string) => (c || '').replace(/\s+/g, '').toUpperCase().trim();
  const target = clean(code);
  return pantones.find(p => clean(p.code) === target);
}

/**
 * Encuentra el ítem en inventario correspondiente a la Pasta Madre Preparada
 */
export function findPastaMadreStockItem(stock: StockItem[], lineType?: string): StockItem | undefined {
  if (!stock || stock.length === 0) return undefined;
  
  // 1. Coincidencia exacta
  const exact = stock.find(s => s.name === 'Pasta Madre (Preparada)') || 
                stock.find(s => s.name.trim().toLowerCase() === 'pasta madre (preparada)') ||
                stock.find(s => s.name.trim().toLowerCase() === 'pasta madre');
  if (exact) return exact;

  // 2. Por nombre que contenga pasta madre
  const byPastaName = stock.find(s => s.name.toLowerCase().includes('pasta madre'));
  if (byPastaName) return byPastaName;

  // 3. Por tipo 'pasta'
  const byType = stock.find(s => s.type === 'pasta');
  if (byType) return byType;

  // 4. Por categoría/tipo según línea de proceso
  if (lineType === 'reactivo') {
    const alginato = stock.find(s => s.name.toLowerCase().includes('espesante') || s.name.toLowerCase().includes('alginato') || s.type === 'sal_alginato');
    if (alginato) return alginato;
  } else if (lineType === 'pigmento') {
    const base = stock.find(s => s.name.toLowerCase().includes('prestovil') || s.name.toLowerCase().includes('base transparente') || s.type === 'base');
    if (base) return base;
  }

  // 5. Cualquier pasta o base
  return stock.find(s => s.name.toLowerCase().includes('pasta') || s.name.toLowerCase().includes('base'));
}

export async function addStockItem(item: StockItem): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, STOCK_COLLECTION), {
      ...item,
      lastUpdated: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, STOCK_COLLECTION);
    throw error;
  }
}

// --- BATCH LOGS CRUD (SALIDAS DE INSUMOS & LOTES) ---

export const INITIAL_BATCHES: BatchLog[] = SALIDA_INSUMOS_RECORDS.map(r => {
  const d = new Date(`${r.date}T12:00:00`);
  return {
    id: r.id,
    pantoneCode: r.product,
    pantoneHex: r.hex,
    productType: 'Toallas',
    productReference: `Requisición (${r.source.split('/').pop()?.replace(/\.xlsx?/i, '') || ''})`,
    lineType: r.line,
    quantity: 0,
    totalGrammage: r.grams,
    operator: 'Bodega Insumos',
    timestamp: d,
    status: 'Completado',
    type: 'preparacion',
  };
});

const DELETED_BATCHES_KEY = 'taller_batches_deleted_ids_v1';

export function getDeletedBatchIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_BATCHES_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {}
  return new Set();
}

export function markBatchAsDeleted(id: string): void {
  try {
    const deleted = getDeletedBatchIds();
    deleted.add(id);
    localStorage.setItem(DELETED_BATCHES_KEY, JSON.stringify(Array.from(deleted)));
  } catch (e) {}
}

export async function getBatchLogs(): Promise<BatchLog[]> {
  const BATCHES_STORAGE_KEY = 'taller_batches_salidas_v1';
  const deletedIds = getDeletedBatchIds();
  let localBatches: BatchLog[] = [];

  const stored = localStorage.getItem(BATCHES_STORAGE_KEY);
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        localBatches = parsed
          .filter(b => b && b.id && !deletedIds.has(b.id))
          .map(b => ({
            ...b,
            timestamp: b.timestamp ? new Date(b.timestamp) : new Date()
          }));
      }
    } catch (e) {}
  } else {
    localBatches = INITIAL_BATCHES.filter(b => b && b.id && !deletedIds.has(b.id));
    try {
      localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(localBatches));
    } catch (e) {}
  }

  try {
    const q = query(collection(db, BATCHES_COLLECTION), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firestoreBatches = snap.docs
        .filter(d => !deletedIds.has(d.id))
        .map(d => {
          const data = d.data();
          const parsedTimestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());
          const parsedFechaHora = data.fecha_hora_registro instanceof Timestamp ? data.fecha_hora_registro.toDate() : (data.fecha_hora_registro ? new Date(data.fecha_hora_registro) : parsedTimestamp);
          const ordenId = data.orden_id || data.workOrderId || '';
          return {
            id: d.id,
            ...data,
            id_mezcla: data.id_mezcla || d.id,
            orden_id: ordenId,
            workOrderId: ordenId,
            color_codigo: data.color_codigo || data.pantoneCode || '',
            fecha_hora_registro: parsedFechaHora,
            estado: data.estado || (data.status === 'Completado' ? 'completado' : (data.status === 'consumido' ? 'consumido' : 'completado')),
            timestamp: parsedTimestamp
          };
        }) as BatchLog[];

      const existingIds = new Set(firestoreBatches.map(b => b.id));
      const merged = [
        ...firestoreBatches,
        ...localBatches.filter(b => b.id && !existingIds.has(b.id) && !deletedIds.has(b.id))
      ];
      try {
        localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    }
  } catch (error) {
    console.warn("Firestore getBatchLogs failed, using local storage/initial batches", error);
  }

  return localBatches;
}

/**
 * Suscripción en tiempo real al historial de preparación de lotes y mezclas
 */
export function subscribeToBatches(onUpdate: (batches: BatchLog[]) => void): () => void {
  try {
    const q = query(collection(db, BATCHES_COLLECTION), orderBy('timestamp', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snap) => {
      const deletedIds = getDeletedBatchIds();
      const firestoreBatches = snap.docs
        .filter(d => !deletedIds.has(d.id))
        .map(d => {
          const data = d.data();
          const parsedTimestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());
          const parsedFechaHora = data.fecha_hora_registro instanceof Timestamp ? data.fecha_hora_registro.toDate() : (data.fecha_hora_registro ? new Date(data.fecha_hora_registro) : parsedTimestamp);
          const ordenId = data.orden_id || data.workOrderId || '';
          return {
            id: d.id,
            ...data,
            id_mezcla: data.id_mezcla || d.id,
            orden_id: ordenId,
            workOrderId: ordenId,
            color_codigo: data.color_codigo || data.pantoneCode || '',
            fecha_hora_registro: parsedFechaHora,
            estado: data.estado || (data.status === 'Completado' ? 'completado' : (data.status === 'consumido' ? 'consumido' : 'completado')),
            timestamp: parsedTimestamp
          };
        }) as BatchLog[];
      onUpdate(firestoreBatches);
    }, (error) => {
      console.warn('Error en listener tiempo real de Batches:', error);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('No se pudo suscribir a Batches:', error);
    return () => {};
  }
}

export async function addBatchLog(batch: BatchLog): Promise<string> {
  try {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const id_mezcla = batch.id_mezcla || `LOTE-${datePart}-${randomSuffix}`;
    const orden_id = batch.orden_id || batch.workOrderId || '';
    const color_codigo = batch.color_codigo || batch.pantoneCode || '';
    const estado = batch.estado || (batch.status === 'consumido' || batch.type === 'consumo' ? 'consumido' : 'completado');

    const batchToSave: any = {
      ...batch,
      id_mezcla,
      orden_id,
      workOrderId: orden_id,
      color_codigo,
      estado,
      status: batch.status || (estado === 'consumido' ? 'consumido' : 'Completado'),
      fecha_hora_registro: serverTimestamp(),
      timestamp: serverTimestamp()
    };

    // 1. Añadir el lote a la base de datos
    const docRef = await addDoc(collection(db, BATCHES_COLLECTION), batchToSave);

    // 2. Descontar stock y manejar Tintas Preparadas según el tipo
    try {
      const stockItems = await getStockItems();
      const pantones = await getPantoneColors();
      const selectedPantone = findMatchingPantone(pantones, batch.pantoneCode);
      const isPastaMadrePrep = (batch.pantoneCode || '').toUpperCase().replace(/\s+/g, '').includes('PASTAMADRE');

      const isConsumo = batch.type === 'consumo';
      const preparedInkName = `Tarro Pantone ${batch.pantoneCode}`;
      const existingPrepared = stockItems.find(s => s.name === preparedInkName && s.type === 'tinta_preparada');

      if (isConsumo) {
        // ES CONSUMO DE PRODUCCIÓN: Solo descontar de la tinta preparada
        if (existingPrepared && existingPrepared.id) {
          const updatedQty = existingPrepared.quantity - batch.totalGrammage;
          await updateStockItemQuantity(existingPrepared.id, updatedQty);
        }
      } else {
        // ES PREPARACIÓN (Calculadora / Órdenes de Trabajo):
        if (!isPastaMadrePrep) {
          // 1. DESCONTAR PASTA MADRE (PREPARADA)
          // La cantidad en batch.totalGrammage (en gramos) representa los Kg de Pasta Madre utilizados.
          const pastaItem = findPastaMadreStockItem(stockItems, batch.lineType);
          if (pastaItem && pastaItem.id) {
            const updatedPastaQty = pastaItem.quantity - batch.totalGrammage;
            await updateStockItemQuantity(pastaItem.id, updatedPastaQty);
          } else {
            // Si aún no existe el ítem en inventario, se crea para reflejar el consumo
            await addDoc(collection(db, STOCK_COLLECTION), {
              name: 'Pasta Madre (Preparada)',
              type: 'pasta',
              category: batch.lineType || 'reactivo',
              quantity: -batch.totalGrammage,
              minRequired: 50000,
              hexColor: '#FDFBF7',
              lastUpdated: serverTimestamp()
            });
          }

          // 2. DESCONTAR TINTAS / COLORANTES SEGÚN LA FÓRMULA
          // Cada component.percentage está expresado en g / Kg (gramos por cada 1000g de pasta madre).
          // Gramos a descontar = (batch.totalGrammage / 1000) * component.percentage
          if (selectedPantone && selectedPantone.formulas && selectedPantone.formulas.length > 0) {
            const kilosPrepared = batch.totalGrammage / 1000;
            for (const component of selectedPantone.formulas) {
              const matchedStock = findMatchingStockItem(stockItems, component.component);
              if (matchedStock && matchedStock.id) {
                const gramsToDeduct = kilosPrepared * (Number(component.percentage) || 0);
                const updatedQty = matchedStock.quantity - gramsToDeduct;
                await updateStockItemQuantity(matchedStock.id, updatedQty);
              }
            }
          }

          // 3. Sumar a la Tinta Preparada
          const netGrams = batch.totalGrammage - (batch.wasteGrams || 0);
          if (existingPrepared && existingPrepared.id) {
            await updateStockItemQuantity(existingPrepared.id, existingPrepared.quantity + netGrams);
          } else {
            await addDoc(collection(db, STOCK_COLLECTION), {
              name: preparedInkName,
              type: 'tinta_preparada',
              category: batch.lineType || 'pigmento',
              quantity: netGrams,
              minRequired: 0,
              hexColor: batch.pantoneHex || '#cccccc',
              lastUpdated: serverTimestamp()
            });
          }
        }
      }
    } catch (err) {
      console.error('Error al actualizar el stock (preparación o consumo):', err);
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, BATCHES_COLLECTION);
    throw error;
  }
}

export async function deleteBatchLog(id: string): Promise<void> {
  const BATCHES_STORAGE_KEY = 'taller_batches_salidas_v1';
  markBatchAsDeleted(id);

  try {
    const stored = localStorage.getItem(BATCHES_STORAGE_KEY);
    if (stored) {
      const list: BatchLog[] = JSON.parse(stored);
      const updated = list.filter(b => b.id !== id);
      localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {}

  try {
    const docRef = doc(db, BATCHES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    // Si no está en Firestore porque es un lote de insumos inicial local, se ignora el error silenciosamente
    console.warn("Firestore deleteBatchLog non-critical warning:", error);
  }
}

// --- TEAM MEMBERS ---

export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const snap = await getDocs(collection(db, TEAM_COLLECTION));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as TeamMember[];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, TEAM_COLLECTION);
    return [];
  }
}

export async function addTeamMember(member: TeamMember): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, TEAM_COLLECTION), member);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, TEAM_COLLECTION);
    throw error;
  }
}

export async function deleteTeamMember(id: string): Promise<void> {
  try {
    const docRef = doc(db, TEAM_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TEAM_COLLECTION}/${id}`);
    throw error;
  }
}

// ==========================================
// MÉTODOS PARA WORK ORDERS
// ==========================================
export async function getWorkOrders(): Promise<WorkOrder[]> {
  let list: WorkOrder[] = [];
  try {
    const q = query(
      collection(db, WORK_ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const querySnapshot = await getDocs(q);
    list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
  } catch (error) {
    console.warn("Could not get work orders from Firestore, fallback to local cache", error);
  }

  // Sincronizar con respaldo local para persistencia inmediata offline
  try {
    const stored = localStorage.getItem('taller_work_orders');
    if (stored) {
      const localOrders = JSON.parse(stored) as WorkOrder[];
      if (Array.isArray(localOrders) && localOrders.length > 0) {
        const existingIds = new Set(list.map(o => o.id));
        for (const lo of localOrders) {
          if (!existingIds.has(lo.id)) {
            list.push(lo);
          }
        }
      }
    }
  } catch (e) {}

  return list;
}

/**
 * Suscripción en tiempo real a las órdenes de trabajo (para TV, tablets y PCs)
 */
export function subscribeToWorkOrders(onUpdate: (orders: WorkOrder[]) => void): () => void {
  try {
    const q = query(
      collection(db, WORK_ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
      onUpdate(orders);
    }, (error) => {
      console.warn("Error en suscripción tiempo real a WorkOrders:", error);
    });
    return unsubscribe;
  } catch (error) {
    console.warn("No se pudo iniciar listener en tiempo real de WorkOrders:", error);
    return () => {};
  }
}

export async function addWorkOrder(order: WorkOrder): Promise<boolean> {
  let createdId = `wo-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, WORK_ORDERS_COLLECTION), {
      ...order,
      createdAt: serverTimestamp()
    });
    createdId = docRef.id;
  } catch (error) {
    console.warn("Firestore addWorkOrder warning:", error);
  }

  // Respaldo en localStorage para consistencia y disponibilidad offline inmediata
  try {
    const stored = localStorage.getItem('taller_work_orders');
    const list: WorkOrder[] = stored ? JSON.parse(stored) : [];
    list.unshift({ ...order, id: createdId, createdAt: new Date() });
    localStorage.setItem('taller_work_orders', JSON.stringify(list));
  } catch (e) {}

  return true;
}

export async function updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<boolean> {
  try {
    const docRef = doc(db, WORK_ORDERS_COLLECTION, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.warn("Firestore updateWorkOrder warning:", error);
  }

  try {
    const stored = localStorage.getItem('taller_work_orders');
    if (stored) {
      const list = (JSON.parse(stored) as WorkOrder[]).map(o => o.id === id ? { ...o, ...updates } : o);
      localStorage.setItem('taller_work_orders', JSON.stringify(list));
    }
  } catch (e) {}

  return true;
}

export async function deleteWorkOrder(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, WORK_ORDERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore deleteWorkOrder warning:", error);
  }

  try {
    const stored = localStorage.getItem('taller_work_orders');
    if (stored) {
      const list = (JSON.parse(stored) as WorkOrder[]).filter(o => o.id !== id);
      localStorage.setItem('taller_work_orders', JSON.stringify(list));
    }
  } catch (e) {}

  return true;
}

// --- DESIGNS CRUD ---

export const INITIAL_DESIGNS: Design[] = INITIAL_EXCEL_DESIGNS;

export async function getDesigns(): Promise<Design[]> {
  let list: Design[] = [];
  try {
    const q = query(collection(db, DESIGNS_COLLECTION));
    const snap = await getDocs(q);
    if (!snap.empty) {
      list = snap.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Design[];
    }
  } catch (error) {
    console.warn("Firestore getDesigns failed, fallback to local", error);
  }

  // Si Firestore está vacío o falló, revisar localStorage
  if (list.length === 0) {
    const stored = localStorage.getItem('taller_designs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch (e) {}
    }
  }

  // Garantizar que todos los 81 diseños existentes del Excel original existan
  const existingNames = new Set(list.map(d => d.name.toUpperCase().trim()));
  const missing = INITIAL_EXCEL_DESIGNS.filter(d => !existingNames.has(d.name.toUpperCase().trim()));
  if (missing.length > 0) {
    for (const m of missing) {
      list.push(m);
      try {
        addDoc(collection(db, DESIGNS_COLLECTION), {
          ...m,
          createdAt: serverTimestamp()
        }).catch(() => {});
      } catch (e) {}
    }
  }

  try {
    localStorage.setItem('taller_designs', JSON.stringify(list));
  } catch (e) {}

  return list;
}

/**
 * Suscripción en tiempo real a diseños multi-color
 */
export function subscribeToDesigns(onUpdate: (designs: Design[]) => void): () => void {
  try {
    const q = query(collection(db, DESIGNS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({
          ...d.data(),
          id: d.id
        })) as Design[];
        onUpdate(list);
      }
    }, (error) => {
      console.warn('Error en listener tiempo real de Designs:', error);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('No se pudo suscribir a Designs:', error);
    return () => {};
  }
}

export async function addDesign(design: Design): Promise<string> {
  let createdId = `des-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, DESIGNS_COLLECTION), {
      ...design,
      createdAt: serverTimestamp()
    });
    createdId = docRef.id;
  } catch (error) {
    console.warn("Firestore addDesign failed, saving locally", error);
  }

  try {
    const current = await getDesigns();
    const updated = [{ ...design, id: createdId }, ...current];
    localStorage.setItem('taller_designs', JSON.stringify(updated));
  } catch (e) {}

  return createdId;
}

export async function deleteDesign(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, DESIGNS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore deleteDesign failed, saving locally", error);
  }

  try {
    const current = await getDesigns();
    const updated = current.filter(d => d.id !== id);
    localStorage.setItem('taller_designs', JSON.stringify(updated));
  } catch (e) {}

  return true;
}

export async function updateDesign(id: string, updates: Partial<Design>): Promise<boolean> {
  try {
    const docRef = doc(db, DESIGNS_COLLECTION, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.warn("Firestore updateDesign failed, saving locally", error);
  }

  try {
    const current = await getDesigns();
    const updated = current.map(d => d.id === id ? { ...d, ...updates } : d);
    localStorage.setItem('taller_designs', JSON.stringify(updated));
  } catch (e) {}

  return true;
}

// --- DAILY PRODUCTION RECORDS CRUD ---

export const TOALLA_DESIGN_NAMES = [
  'FRUTAS ANDU',
  'FRUTAS ANDU VIEJAS',
  'GRANJA ANDU',
  'GRANJAS ANDU',
  'NAVIDAD ANDU',
  'NAVIDAD LINEA',
  'QE FRUTAS',
  'QE UTENCILIOS',
  'QE UTENSILIO',
  'QEFRUTAS',
  'VACAS ANDU'
];

export function isToallaDesign(designName?: string, widthM?: number, lineType?: string): boolean {
  const norm = (designName || '').toUpperCase().trim();
  if (TOALLA_DESIGN_NAMES.includes(norm)) return true;
  if (norm.includes('ANDU') || norm.includes('TOALLA') || norm.startsWith('QE ')) return true;
  if (widthM !== undefined && widthM <= 0.40 && (lineType?.toUpperCase() === 'PIGMENTO' || !lineType)) return true;
  return false;
}

export function normalizeProductionRecord(r: DailyProductionRecord): DailyProductionRecord {
  const normName = (r.designName || '').toUpperCase().trim();
  const isToalla = isToallaDesign(normName, r.widthM, r.process);

  const widthM = isToalla ? 0.35 : (r.widthM || 0.60);
  const heightM = isToalla ? 0.60 : (r.heightM || 1.20);
  const gramaje = isToalla ? 310 : (r.gramaje || 280);
  const areaM2 = isToalla ? 0.21 : Number((widthM * heightM).toFixed(2));
  const unitWeightG = isToalla ? 63 : (r.unitWeightG || Number((areaM2 * gramaje).toFixed(1)));
  const process: 'PIGMENTO' | 'REACTIVO' = isToalla ? 'PIGMENTO' : (r.process || 'REACTIVO');
  
  // Toallas en pigmento: siempre 5 piezas por golpe (3036 unidades / 5 = 607 golpes)
  const golpes = isToalla 
    ? Math.round((r.units || 0) / 5) 
    : (r.golpes || (widthM <= 0.40 ? Math.round((r.units || 0) / 5) : Math.round((r.units || 0) / 3)));
  
  // Kilos de tela: (unidades * peso_unitario_gramos) / 1000 (3036 * 63 / 1000 = 191.27 kg)
  const kgDay = Number((((r.units || 0) * unitWeightG) / 1000).toFixed(2));

  return {
    ...r,
    designName: normName,
    widthM,
    heightM,
    gramaje,
    areaM2,
    unitWeightG,
    process,
    golpes,
    kgDay
  };
}

export function getRecordKg(r: DailyProductionRecord): number {
  if (!r) return 0;
  if (r.units && r.unitWeightG) {
    return Number(((r.units * r.unitWeightG) / 1000).toFixed(2));
  }
  return r.kgDay || 0;
}

export function getRecordGolpes(r: DailyProductionRecord): number {
  if (!r) return 0;
  if (isToallaDesign(r.designName, r.widthM, r.process)) {
    return Math.round((r.units || 0) / 5);
  }
  return r.golpes || (r.widthM <= 0.40 ? Math.round((r.units || 0) / 5) : Math.round((r.units || 0) / 3));
}

export const INITIAL_PRODUCTION_RECORDS: DailyProductionRecord[] = FULL_YEAR_PRODUCTION_RECORDS.map(normalizeProductionRecord);

const PRODUCTION_STORAGE_KEY = 'daily_production_records_v6';
const DELETED_PRODUCTION_RECORDS_KEY = 'taller_production_records_deleted_ids_v1';

export function getDeletedProductionRecordIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_PRODUCTION_RECORDS_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {}
  return new Set();
}

export function markProductionRecordAsDeleted(id: string): void {
  try {
    const deleted = getDeletedProductionRecordIds();
    deleted.add(id);
    localStorage.setItem(DELETED_PRODUCTION_RECORDS_KEY, JSON.stringify(Array.from(deleted)));
  } catch (e) {}
}

export async function getProductionRecords(): Promise<DailyProductionRecord[]> {
  const deletedIds = getDeletedProductionRecordIds();
  let localRecords: DailyProductionRecord[] = [];

  // Fallback local storage
  const stored = localStorage.getItem(PRODUCTION_STORAGE_KEY) || localStorage.getItem('daily_production_records_v5');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const hasCorruptData = Array.isArray(parsed) && parsed.some((r: any) => Number(r.units) > 50000);
      if (Array.isArray(parsed) && parsed.length >= FULL_YEAR_PRODUCTION_RECORDS.length && !hasCorruptData) {
        localRecords = parsed.map(normalizeProductionRecord);
      }
    } catch (e) {}
  }

  // Si no hay datos locales limpios, usar los 341 registros normalizados del 2026
  if (localRecords.length === 0) {
    localRecords = INITIAL_PRODUCTION_RECORDS;
    try {
      localStorage.removeItem('daily_production_records');
      localStorage.removeItem('daily_production_records_v2');
      localStorage.removeItem('daily_production_records_v3');
      localStorage.removeItem('daily_production_records_v4');
      localStorage.removeItem('daily_production_records_v5');
      localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTION_RECORDS));
    } catch (e) {}
  }

  const filterDeleted = (records: DailyProductionRecord[]): DailyProductionRecord[] => {
    return records.filter(r => {
      if (r.id && deletedIds.has(r.id)) return false;
      if (r.workOrderId && (deletedIds.has(r.workOrderId) || deletedIds.has(`order-${r.workOrderId}`))) return false;
      const key = `${r.date}__${(r.designName || '').toUpperCase().trim()}__${r.shift || 1}`;
      if (deletedIds.has(key)) return false;
      return true;
    });
  };

  // Deduplicación estricta por fecha, nombre de diseño y turno, eliminando temporales
  const deduplicate = (records: DailyProductionRecord[]): DailyProductionRecord[] => {
    const map = new Map<string, DailyProductionRecord>();
    for (const r of records) {
      if (r.id && r.id.startsWith('order-temp-')) continue;
      const key = `${r.date}__${(r.designName || '').toUpperCase().trim()}__${r.shift || 1}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        if ((!existing.golpes && r.golpes) || (!existing.workOrderId && r.workOrderId)) {
          map.set(key, r);
        }
      }
    }
    return Array.from(map.values()).map(normalizeProductionRecord);
  };

  localRecords = filterDeleted(deduplicate(localRecords));

  // Si Firestore está conectado y tiene registros, combinarlos sin duplicar
  try {
    const q = query(collection(db, PRODUCTION_RECORDS_COLLECTION));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firestoreRecords = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }) as unknown as DailyProductionRecord).map(normalizeProductionRecord);

      const merged = filterDeleted(deduplicate([...localRecords, ...firestoreRecords]));
      try {
        localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    }
  } catch (error) {
    console.warn("Firestore getProductionRecords failed, using local storage", error);
  }

  return localRecords;
}

export async function addProductionRecord(record: DailyProductionRecord): Promise<string> {
  const normalized = normalizeProductionRecord(record);
  let createdId = normalized.id || `prod-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, PRODUCTION_RECORDS_COLLECTION), {
      ...normalized,
      createdAt: serverTimestamp()
    });
    createdId = docRef.id;
  } catch (error) {
    console.warn("Firestore addProductionRecord failed, saving locally", error);
  }

  // Save to local storage as well
  try {
    const current = await getProductionRecords();
    const updated = [{ ...normalized, id: createdId }, ...current.filter(r => r.id !== createdId)];
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('production-records-updated'));
  } catch (e) {}

  return createdId;
}

export async function updateProductionRecord(id: string, updates: Partial<DailyProductionRecord>): Promise<boolean> {
  try {
    const docRef = doc(db, PRODUCTION_RECORDS_COLLECTION, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.warn("Firestore updateProductionRecord failed, saving locally", error);
  }

  try {
    const current = await getProductionRecords();
    const updated = current.map(r => r.id === id ? normalizeProductionRecord({ ...r, ...updates }) : r);
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('production-records-updated'));
  } catch (e) {}

  return true;
}

export async function deleteProductionRecord(id: string): Promise<boolean> {
  markProductionRecordAsDeleted(id);
  if (id.startsWith('order-')) {
    markProductionRecordAsDeleted(id.replace('order-', ''));
  }

  if (!id.startsWith('prod-')) {
    try {
      const docRef = doc(db, PRODUCTION_RECORDS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn("Firestore deleteProductionRecord failed, saving locally", error);
    }
  }

  try {
    const current = await getProductionRecords();
    const toDelete = current.find(r => r.id === id || r.workOrderId === id || `order-${r.workOrderId}` === id);
    if (toDelete) {
      markProductionRecordAsDeleted(`${toDelete.date}__${(toDelete.designName || '').toUpperCase().trim()}__${toDelete.shift || 1}`);
    }

    const updated = current.filter(r => 
      r.id !== id && 
      r.workOrderId !== id && 
      `order-${r.workOrderId}` !== id &&
      !(toDelete && r.date === toDelete.date && (r.designName || '').toUpperCase().trim() === (toDelete.designName || '').toUpperCase().trim() && (r.shift || 1) === (toDelete.shift || 1))
    );
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('production-records-updated'));
  } catch (e) {}

  return true;
}

/**
 * Sincroniza todas las filas de producción existentes cuando el usuario actualiza
 * el peso unitario, gramaje o dimensiones de un diseño en el Gestor de Diseños.
 */
export async function syncDesignToProductionRecords(
  designName: string,
  unitWeightG: number,
  gramaje?: number,
  widthCm?: number,
  heightCm?: number,
  piezasPorGolpe?: number
): Promise<void> {
  const normName = (designName || '').toUpperCase().trim();
  const current = await getProductionRecords();
  let modified = false;

  const updated = current.map(r => {
    if ((r.designName || '').toUpperCase().trim() === normName) {
      modified = true;
      const isToalla = isToallaDesign(normName, widthCm ? widthCm / 100 : r.widthM, r.process);
      const wM = widthCm !== undefined && widthCm > 0
        ? Number((widthCm / 100).toFixed(2))
        : (isToalla ? 0.35 : (r.widthM || 0.60));
      const hM = heightCm !== undefined && heightCm > 0
        ? Number((heightCm / 100).toFixed(2))
        : (isToalla ? 0.60 : (r.heightM || 1.20));
      const gr = gramaje !== undefined && gramaje > 0
        ? gramaje
        : (isToalla ? 310 : (r.gramaje || 280));
      const wWeight = unitWeightG !== undefined && unitWeightG > 0
        ? unitWeightG
        : (isToalla ? 63 : (r.unitWeightG || 201.6));
      const area = Number((wM * hM).toFixed(2));
      const pxg = piezasPorGolpe !== undefined && piezasPorGolpe > 0
        ? piezasPorGolpe
        : (isToalla ? 5 : (wM <= 0.40 ? 5 : 3));
      const golpes = Math.round((r.units || 0) / pxg);
      const kgDay = Number((((r.units || 0) * wWeight) / 1000).toFixed(2));

      const updatedRecord: DailyProductionRecord = {
        ...r,
        widthM: wM,
        heightM: hM,
        gramaje: gr,
        areaM2: area,
        unitWeightG: wWeight,
        golpes,
        kgDay
      };

      if (r.id && !r.id.startsWith('prod-')) {
        try {
          updateDoc(doc(db, PRODUCTION_RECORDS_COLLECTION, r.id), {
            widthM: wM,
            heightM: hM,
            gramaje: gr,
            areaM2: area,
            unitWeightG: wWeight,
            golpes,
            kgDay
          }).catch(() => {});
        } catch (e) {}
      }

      return updatedRecord;
    }
    return r;
  });

  if (modified) {
    try {
      localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('production-records-updated'));
    } catch (e) {}
  }
}

/**
 * Convierte una Orden de Trabajo en un Registro Diario de Producción con cálculo exacto
 * de golpes, unidades, m2, peso unitario y kilos de tela procesada.
 */
export function convertWorkOrderToProductionRecord(order: WorkOrder, designs: Design[] = []): DailyProductionRecord | null {
  if (!order || (!order.designName && !order.designId)) return null;

  // REQUISITO: No debe colocarse en el reporte diario hasta dar por FINALIZADA la orden
  if (order.status !== 'Completada') return null;

  // Extraer fecha en formato ISO YYYY-MM-DD (priorizar orderDate programada)
  let dateStr = order.orderDate || new Date().toISOString().slice(0, 10);
  if (!order.orderDate) {
    const rawDate = order.completedAt || order.createdAt;
    if (rawDate) {
      if (typeof rawDate === 'string') {
        dateStr = rawDate.slice(0, 10);
      } else if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10);
      } else if (typeof rawDate.toDate === 'function') {
        try {
          dateStr = rawDate.toDate().toISOString().slice(0, 10);
        } catch (e) {}
      } else if (rawDate.seconds) {
        dateStr = new Date(rawDate.seconds * 1000).toISOString().slice(0, 10);
      }
    }
  }

  // Buscar diseño coincidente
  const design = designs.find(d => 
    (order.designId && d.id === order.designId) ||
    (order.designName && d.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
  );

  const designName = (order.designName || design?.name || 'DISEÑO').toUpperCase().trim();
  const units = Number(order.targetQuantity) || 0;
  if (units <= 0 && !designName) return null;

  const widthM = design?.widthCm ? Number((design.widthCm / 100).toFixed(2)) : 0.60;
  const heightM = design?.heightCm ? Number((design.heightCm / 100).toFixed(2)) : 1.20;
  const gramaje = design?.gramaje || 280;
  const areaM2 = Number((widthM * heightM).toFixed(4));
  const unitWeightG = design?.unitWeight ? Number(design.unitWeight.toFixed(2)) : Number((areaM2 * gramaje).toFixed(2));
  const kgDay = Number(((units * unitWeightG) / 1000).toFixed(2));

  // Piezas por golpe según diseño o proceso (Toallas pigmento 35x60 son de 5)
  const isPigmentoToalla = 
    ((order.lineType || design?.lineType || '').toLowerCase() !== 'reactivo') || widthM <= 0.40;
  const ratio = isPigmentoToalla ? 5 : (design?.piezasPorGolpe || 3);
  const golpes = Math.ceil(units / ratio);
  const process: 'PIGMENTO' | 'REACTIVO' = 
    ((order.lineType || design?.lineType || 'reactivo').toLowerCase() === 'pigmento') ? 'PIGMENTO' : 'REACTIVO';

  if (!order.id) return null;

  return {
    id: `order-${order.id}`,
    workOrderId: order.id,
    date: dateStr,
    designName,
    shift: 1,
    widthM,
    heightM,
    gramaje,
    process,
    areaM2,
    unitWeightG,
    units,
    kgDay,
    golpes,
    status: 'Completada',
    notes: `Orden de Trabajo #${order.id?.slice(-4) || ''}`
  };
}

/**
 * Sincroniza las órdenes de trabajo FINALIZADAS con los registros de producción diaria y mensual,
 * evitando cualquier duplicación y eliminando órdenes pendientes o temporales.
 */
export async function syncWorkOrdersToProductionRecords(
  workOrders: WorkOrder[], 
  designs: Design[] = []
): Promise<DailyProductionRecord[]> {
  const currentRecords = await getProductionRecords();
  const PRODUCTION_STORAGE_KEY = 'daily_production_records_v6';

  if (!workOrders || workOrders.length === 0) return currentRecords;

  // Identificar qué órdenes están completadas y cuáles incompletas
  const deletedIds = getDeletedProductionRecordIds();
  const completedOrders = workOrders.filter(o => 
    o.status === 'Completada' && 
    !deletedIds.has(o.id || '') && 
    !deletedIds.has(`order-${o.id}`)
  );
  const incompleteOrderIds = new Set(workOrders.filter(o => o.status !== 'Completada').map(o => o.id));

  // 1. Filtrar registros previos:
  // - Eliminar temporales huérfanos 'order-temp-'
  // - Eliminar registros de órdenes que NO estén completadas o hayan sido eliminadas
  const validRecords = currentRecords.filter(r => {
    if (r.id && r.id.startsWith('order-temp-')) return false;
    if (r.id && deletedIds.has(r.id)) return false;
    if (r.workOrderId && (incompleteOrderIds.has(r.workOrderId) || deletedIds.has(r.workOrderId) || deletedIds.has(`order-${r.workOrderId}`))) return false;
    if (r.id && r.id.startsWith('order-')) {
      const oId = r.id.replace('order-', '');
      if (incompleteOrderIds.has(oId) || deletedIds.has(oId) || deletedIds.has(r.id)) return false;
    }
    return true;
  });

  // 2. Mapa por clave única (date + designName + shift) para evitar duplicación
  const recordsMap = new Map<string, DailyProductionRecord>();
  for (const r of validRecords) {
    const key = `${r.date}__${(r.designName || '').toUpperCase().trim()}__${r.shift || 1}`;
    recordsMap.set(key, r);
  }

  // 3. Sincronizar SOLO órdenes completadas que no estén eliminadas
  for (const order of completedOrders) {
    const prodRec = convertWorkOrderToProductionRecord(order, designs);
    if (!prodRec) continue;

    const key = `${prodRec.date}__${prodRec.designName}__${prodRec.shift || 1}`;
    if (!deletedIds.has(key)) {
      recordsMap.set(key, prodRec);
    }
  }

  const updated = Array.from(recordsMap.values());
  try {
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('production-records-updated'));
  } catch (e) {}

  return updated;
}

/**
 * Elimina el registro de producción asociado a una orden borrada
 */
export async function removeProductionRecordForOrder(orderId: string): Promise<void> {
  const PRODUCTION_STORAGE_KEY = 'daily_production_records_v6';
  markProductionRecordAsDeleted(orderId);
  markProductionRecordAsDeleted(`order-${orderId}`);
  try {
    const current = await getProductionRecords();
    const updated = current.filter(r => r.id !== `order-${orderId}` && r.workOrderId !== orderId);
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('production-records-updated'));
  } catch (e) {}
}

