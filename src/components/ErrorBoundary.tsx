import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Capturado error no controlado:', error, errorInfo);

    // Auto-recuperación si es un error de carga de módulos/chunks (muy común al abrir en otra PC o tras actualización)
    const errorMsg = (error?.message || '').toLowerCase();
    const isChunkError = 
      errorMsg.includes('dynamically imported module') ||
      errorMsg.includes('loading chunk') ||
      errorMsg.includes('failed to fetch') ||
      errorMsg.includes('error loading module');

    if (isChunkError) {
      const reloadKey = 'eb_chunk_auto_reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(reloadKey, now.toString());
        console.warn('[ErrorBoundary] Error de módulo detectado. Recargando automáticamente...');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = () => {
    try {
      // Limpiar datos temporales de sesión o marcas de carga
      sessionStorage.clear();
      localStorage.removeItem('activeTab');
    } catch (e) {
      console.warn('Error al limpiar almacenamiento local:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMsg = this.state.error?.message || 'Error desconocido';

      return (
        <div className="min-h-screen w-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200/60 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
              Interrupción temporal en la aplicación
            </h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Ocurrió una pausa al cargar los recursos de esta pantalla. Al recargar la página, el navegador descargará los componentes necesarios.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar Sistema
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                title="Restaura la sesión y recarga de cero"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                Limpiar y Recargar
              </button>
            </div>

            {/* Detalles técnicos colapsables */}
            <div className="border-t border-slate-100 pt-4 text-left">
              <button
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-600 font-semibold py-1 cursor-pointer"
              >
                <span>Detalle técnico del error</span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 leading-relaxed">
                  <p className="font-bold text-red-400 mb-1">{errorMsg}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-slate-400 text-[10px] whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
