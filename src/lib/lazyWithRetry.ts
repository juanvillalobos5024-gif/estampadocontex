import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Envoltorio para React.lazy con reintentos automáticos.
 * Previene pantallas en blanco cuando la conexión de red en otra PC sufre un micro-corte
 * o cuando Vite / el servidor Web tarda en entregar un chunk de código.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 800
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: any) => {
            if (remaining > 0) {
              console.warn(
                `[lazyWithRetry] Error al cargar módulo. Reintentando (${remaining} intentos restantes)...`,
                error
              );
              setTimeout(() => attempt(remaining - 1), interval);
            } else {
              console.error('[lazyWithRetry] Falló la carga del módulo tras reintentos.', error);

              // Si es un error de chunk o módulo dinámico, comprobar si podemos recargar la página una sola vez
              const errorMsg = (error?.message || '').toLowerCase();
              const isChunkError =
                errorMsg.includes('failed to fetch') ||
                errorMsg.includes('dynamically imported module') ||
                errorMsg.includes('loading chunk');

              if (isChunkError && typeof window !== 'undefined') {
                const reloadKey = 'lazy_chunk_reload_' + window.location.pathname;
                const alreadyReloaded = sessionStorage.getItem(reloadKey);
                if (!alreadyReloaded) {
                  sessionStorage.setItem(reloadKey, 'true');
                  console.warn('[lazyWithRetry] Recargando página para sincronizar con la nueva versión...');
                  window.location.reload();
                  return;
                }
              }

              reject(error);
            }
          });
      };

      attempt(retries);
    })
  );
}
