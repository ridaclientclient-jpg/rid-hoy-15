'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-rida-dark text-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-white mb-2">Error</p>
          <p className="text-sm text-gray-400 mb-4">Ocurrio un error inesperado.</p>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-sm font-medium hover:bg-cyan-500/25 transition-all"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
