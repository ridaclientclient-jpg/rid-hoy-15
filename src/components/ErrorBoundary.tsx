'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Auto-reload on chunk load errors (stale cache after deploy)
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      (error.message && error.message.includes('Loading chunk')) ||
      (error.message && error.message.includes('Failed to load chunk'));

    if (isChunkError) {
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] bg-rida-dark flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-semibold text-white mb-2">Error inesperado</p>
            <p className="text-sm text-gray-400 mb-4">
              Ocurrio un error al cargar esta pagina.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Recargar pagina completa
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
