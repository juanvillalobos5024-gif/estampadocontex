import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
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

// Inicializar Firestore (usando la base de datos por defecto del proyecto)
const db = getFirestore(app);

// Inicializar Auth
const auth = getAuth(app);

// Intentar habilitar la persistencia offline para que el taller no dependa de internet 100%
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('La persistencia de Firestore falló debido a múltiples pestañas abiertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('El navegador no soporta persistencia de Firestore.');
    }
  });
} catch (e) {
  console.warn('Persistencia offline de Firestore no configurada.', e);
}

export { app, db, auth };
