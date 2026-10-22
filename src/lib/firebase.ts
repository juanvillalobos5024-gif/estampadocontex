import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuración cargada directamente desde el archivo de configuración provisto por la plataforma
const firebaseConfig = {
  apiKey: "AIzaSyAI1k22CsW3wt59HfwejTiGBvBMf2-yjg0",
  authDomain: "control-de-ingreso-641b9.firebaseapp.com",
  projectId: "control-de-ingreso-641b9",
  storageBucket: "control-de-ingreso-641b9.firebasestorage.app",
  messagingSenderId: "976708497064",
  appId: "1:976708497064:web:9423ab1467e27d9b801c9d"
};

// Inicializar la aplicación Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con soporte multi-pestaña moderno y tolerancia a fallos
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn('Iniciando Firestore estándar sin persistencia local:', e);
  db = getFirestore(app);
}

// Inicializar Auth
const auth = getAuth(app);

export { app, db, auth };

