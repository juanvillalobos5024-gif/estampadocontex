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
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { PantoneColor, StockItem, BatchLog, TeamMember } from '../types';

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

const INITIAL_STOCK: StockItem[] = [
  // Línea Serigrafía (Pigmentos)
  { name: 'Base Clear 001', type: 'base', category: 'serigrafia', quantity: 25000, minRequired: 5000 },
  { name: 'Elastic Base EB-10', type: 'base', category: 'serigrafia', quantity: 18000, minRequired: 4000 },
  { name: 'Red Pigment RV', type: 'pigmento', category: 'serigrafia', quantity: 3200, minRequired: 1000 },
  { name: 'Blue Pigment BL', type: 'pigmento', category: 'serigrafia', quantity: 4500, minRequired: 1000 },
  { name: 'Yellow Pigment YE', type: 'pigmento', category: 'serigrafia', quantity: 5000, minRequired: 800 },
  { name: 'Black Pigment BK', type: 'pigmento', category: 'serigrafia', quantity: 2000, minRequired: 500 },
  { name: 'Orange Pigment OR', type: 'pigmento', category: 'serigrafia', quantity: 1500, minRequired: 500 },
  { name: 'White Matte 05', type: 'base', category: 'serigrafia', quantity: 8000, minRequired: 2000 },
  { name: 'Fixer F-10', type: 'aditivo', category: 'serigrafia', quantity: 2500, minRequired: 500 },

  // Línea Colorantes Reactivos
  { name: 'Pasta Espesante Alginato de Sodio', type: 'pasta', category: 'reactivo', quantity: 40000, minRequired: 10000 },
  { name: 'Azul Reactivo H-EXL', type: 'colorante_reactivo', category: 'reactivo', quantity: 3500, minRequired: 800 },
  { name: 'Rojo Reactivo M-3B', type: 'colorante_reactivo', category: 'reactivo', quantity: 2800, minRequired: 800 },
  { name: 'Amarillo Reactivo H-A', type: 'colorante_reactivo', category: 'reactivo', quantity: 3100, minRequired: 800 },
  { name: 'Negro Reactivo B', type: 'colorante_reactivo', category: 'reactivo', quantity: 6000, minRequired: 1500 },
  { name: 'Urea Auxiliar Textil', type: 'aditivo', category: 'reactivo', quantity: 15000, minRequired: 5000 },
  { name: 'Carbonato de Sodio (Fijador)', type: 'aditivo', category: 'reactivo', quantity: 12000, minRequired: 3000 }
];

const INITIAL_TEAM: TeamMember[] = [
  { name: 'Jorge Martínez', role: 'Jefe de Estampado', active: true },
  { name: 'Enoc Chatelain', role: 'Líder de Color / Serigrafía', active: true },
  { name: 'Mateo Gómez', role: 'Prensista de Toallas', active: true },
  { name: 'Santiago Ruiz', role: 'Operario de Mezclado', active: true },
  { name: 'Camila Ríos', role: 'Auxiliar de Laboratorio', active: true }
];

const INITIAL_BATCHES: BatchLog[] = [
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
    productType: 'Hamacas',
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
      for (const batch of INITIAL_BATCHES) {
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
    }
  } catch (error) {
    console.error('Error al sembrar base de datos:', error);
  }
}

// --- PANTONES CRUD ---

export async function getPantoneColors(): Promise<PantoneColor[]> {
  try {
    const q = query(collection(db, PANTONES_COLLECTION), orderBy('code'));
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

// --- BATCH LOGS CRUD ---

export async function getBatchLogs(): Promise<BatchLog[]> {
  try {
    const q = query(collection(db, BATCHES_COLLECTION), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now()
      };
    }) as BatchLog[];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, BATCHES_COLLECTION);
    return [];
  }
}

export async function addBatchLog(batch: BatchLog): Promise<string> {
  try {
    // 1. Añadir el lote a la base de datos
    const docRef = await addDoc(collection(db, BATCHES_COLLECTION), {
      ...batch,
      timestamp: serverTimestamp()
    });

    // 2. Descontar stock automáticamente si encontramos los componentes
    try {
      const stockItems = await getStockItems();
      const pantones = await getPantoneColors();
      const selectedPantone = pantones.find(p => p.code === batch.pantoneCode);
      
      if (selectedPantone) {
        for (const component of selectedPantone.formulas) {
          const matchedStock = stockItems.find(s => s.name === component.component);
          if (matchedStock && matchedStock.id) {
            // Gramos a descontar: porcentaje * peso total / 100
            const gramsToDeduct = (component.percentage * batch.totalGrammage) / 100;
            const updatedQty = matchedStock.quantity - gramsToDeduct;
            await updateStockItemQuantity(matchedStock.id, updatedQty);
          }
        }
      }
    } catch (err) {
      console.error('Error al descontar el stock de manera automática:', err);
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, BATCHES_COLLECTION);
    throw error;
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
