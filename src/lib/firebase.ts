import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuración cargada directamente desde el archivo de configuración provisto por la plataforma
const firebaseConfig = {
  apiKey: "AIzaSyBG3SEZLMVRqrjWC5XsF7yE4G8m5KUNZSQ",
  authDomain: "resonant-vortex-d9z5m.firebaseapp.com",
  projectId: "resonant-vortex-d9z5m",
  storageBucket: "resonant-vortex-d9z5m.firebasestorage.app",
  messagingSenderId: "618279813531",
  appId: "1:618279813531:web:9b3b4619521cea438d613e"
};

// Inicializar la aplicación Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con la base de datos específica de la applet
const db = getFirestore(app, "ai-studio-86f1b42c-60f8-4d4e-afc2-25cdc6984ecf");

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
