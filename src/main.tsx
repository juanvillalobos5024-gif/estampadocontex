import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Escuchar fallos en la descarga de módulos dinámicos de Vite (evita pantallas blancas al abrir en otras PCs)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Error de precarga de módulo dinámico. Auto-recargando...', event);
  const lastReload = sessionStorage.getItem('vite_preload_reload_ts');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
    sessionStorage.setItem('vite_preload_reload_ts', now.toString());
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

