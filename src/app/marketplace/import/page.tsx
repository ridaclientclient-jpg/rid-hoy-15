'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, FileText, CheckCircle, XCircle, Clock,
  AlertCircle, FileSpreadsheet, Trash2, Eye, Loader2, X, Package,
  ArrowRight, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';

/* ── Types ──────────────────────────────────────────────── */

interface ImportRecord {
  id: string;
  fileName: string;
  date: string;
  totalRows: number;
  productsImported: number;
  errors: number;
  status: 'success' | 'partial' | 'error';
}

interface ParsedRow {
  row: number;
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  en_stock: string;
  valid: boolean;
  errors: string[];
}

/* ── CSV Parser (handles quoted fields, UTF-8) ─────────── */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field.trim());
        field = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c.length > 0)) {
          rows.push(current);
        }
        current = [];
        if (char === '\r') i++; // skip \n in \r\n
      } else if (char === '\r') {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c.length > 0)) {
          rows.push(current);
        }
        current = [];
      } else {
        field += char;
      }
    }
  }
  // last field
  current.push(field.trim());
  if (current.some((c) => c.length > 0)) {
    rows.push(current);
  }

  return rows;
}

/* ── Normalize header names ─────────────────────────────── */

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

const EXPECTED_HEADERS = ['nombre', 'descripcion', 'precio', 'categoria', 'en_stock'];
const REQUIRED_HEADERS = ['nombre', 'precio'];

function mapHeaders(rawHeaders: string[]): Map<number, string> {
  const mapping = new Map<number, string>();
  for (let i = 0; i < rawHeaders.length; i++) {
    const norm = normalizeHeader(rawHeaders[i]);
    const match = EXPECTED_HEADERS.find((h) => norm === h || norm === h.replace('_', ''));
    if (match) mapping.set(i, match);
  }
  return mapping;
}

/* ── Validate parsed rows ───────────────────────────────── */

function validateRows(
  dataRows: string[][],
  headerMap: Map<number, string>
): ParsedRow[] {
  return dataRows.map((cols, idx) => {
    const row: ParsedRow = {
      row: idx + 2, // +1 for 1-based, +1 for header
      nombre: '',
      descripcion: '',
      precio: '',
      categoria: '',
      en_stock: '',
      valid: true,
      errors: [],
    };

    for (const [colIdx, header] of headerMap.entries()) {
      const val = (cols[colIdx] || '').trim();
      switch (header) {
        case 'nombre':
          row.nombre = val;
          break;
        case 'descripcion':
          row.descripcion = val;
          break;
        case 'precio':
          row.precio = val;
          break;
        case 'categoria':
          row.categoria = val;
          break;
        case 'en_stock':
          row.en_stock = val;
          break;
      }
    }

    // Validate required fields
    if (!row.nombre) {
      row.valid = false;
      row.errors.push('Nombre requerido');
    }
    if (!row.precio) {
      row.valid = false;
      row.errors.push('Precio requerido');
    } else if (isNaN(Number(row.precio)) || Number(row.precio) < 0) {
      row.valid = false;
      row.errors.push('Precio inválido');
    }
    // Validate optional en_stock
    if (row.en_stock && !['true', 'false', '1', '0', 'si', 'no', 'yes', 'no', ''].includes(row.en_stock.toLowerCase())) {
      // Not an error, just normalize later
    }

    return row;
  });
}

/* ── Component ──────────────────────────────────────────── */

export default function ImportPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading } = useVendorId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importingFile, setImportingFile] = useState('');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewFileName, setPreviewFileName] = useState('');
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);

  /* ── vendorId provided by useVendorId hook ──────── */

  /* ── Handle file selection ────────────────────────────── */
  const handleFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Solo se aceptan archivos CSV');
        return;
      }
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo supera el límite de 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          toast.error('No se pudo leer el archivo');
          return;
        }

        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast.error('El archivo no contiene datos suficientes (se necesita al menos encabezado + 1 fila)');
          return;
        }

        const headerRow = rows[0];
        const dataRows = rows.slice(1);
        const headerMap = mapHeaders(headerRow);

        // Check required headers exist
        let hasNombre = false;
        let hasPrecio = false;
        for (const [, h] of headerMap) {
          if (h === 'nombre') hasNombre = true;
          if (h === 'precio') hasPrecio = true;
        }
        if (!hasNombre || !hasPrecio) {
          toast.error('Faltan columnas obligatorias: nombre, precio');
          return;
        }

        const validated = validateRows(dataRows, headerMap);
        setParsedRows(validated);
        setPreviewFileName(file.name);
        setValidCount(validated.filter((r) => r.valid).length);
        setInvalidCount(validated.filter((r) => !r.valid).length);
        setShowPreview(true);
      };
      reader.readAsText(file, 'UTF-8');
    },
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  /* ── Execute import via SECURITY DEFINER RPC ─────────── */
  const executeImport = async () => {
    if (!vendorId) {
      toast.error('No se encontró la tienda asociada. Asegúrate de estar registrado como vendedor.');
      return;
    }

    setShowPreview(false);
    setImporting(true);
    setImportingFile(previewFileName);
    setImportProgress(10);

    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error('No hay filas validas para importar');
      setImporting(false);
      return;
    }

    // Build JSONB array for the RPC
    const productsJSON = validRows.map((r) => ({
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      precio: Number(r.precio),
      categoria: r.categoria || 'General',
      en_stock: ['true', '1', 'si', 'yes'].includes(r.en_stock.toLowerCase()),
    }));

    try {
      setImportProgress(40);
      const { data, error } = await supabase.rpc('bulk_insert_vendor_products', {
        p_vendor_id: vendorId,
        p_products: productsJSON,
      });

      setImportProgress(90);

      if (error) {
        console.error('[CSV Import] RPC error:', error);
        throw error;
      }

      const results = data || [];
      const imported = results.filter((r: { success: boolean }) => r.success).length;
      const errors = results.filter((r: { success: boolean }) => !r.success).length;

      if (errors > 0) {
        const errorRows = results.filter((r: { success: boolean; name: string; error: string }) => !r.success);
        console.warn('[CSV Import] Errors:', errorRows);
      }

      const status: ImportRecord['status'] = errors === 0 ? 'success' : imported > 0 ? 'partial' : 'error';
      const record: ImportRecord = {
        id: Date.now().toString(),
        fileName: previewFileName,
        date: new Date().toISOString().split('T')[0],
        totalRows: parsedRows.length,
        productsImported: imported,
        errors,
        status,
      };

      setHistory((prev) => [record, ...prev]);
      setImportProgress(100);

      if (status === 'success') {
        toast.success(`Importación exitosa: ${imported} productos importados`);
      } else if (status === 'partial') {
        toast.warning(`Importación parcial: ${imported} exitosos, ${errors} con error`);
      } else {
        toast.error(`Importación fallida: ${errors} errores`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al importar';
      toast.error(msg);
      const record: ImportRecord = {
        id: Date.now().toString(),
        fileName: previewFileName,
        date: new Date().toISOString().split('T')[0],
        totalRows: parsedRows.length,
        productsImported: 0,
        errors: parsedRows.length,
        status: 'error',
      };
      setHistory((prev) => [record, ...prev]);
    } finally {
      setImporting(false);
      setImportProgress(0);
      setImportingFile('');
    }
  };

  /* cancelImport removed — RPC runs as a single call */

  /* ── Download template ────────────────────────────────── */
  const handleDownloadTemplate = () => {
    const csvContent =
      'nombre,descripcion,precio,categoria,en_stock\n' +
      '"Ibuprofeno 600mg","Antiinflamatorio, caja 20 tabletas",3500,Farmacia,true\n' +
      '"Paracetamol 500mg","Analgésico, caja 30 tabletas",2200,Farmacia,true\n' +
      '"Casado Tradicional","Arroz, frijoles, ensalada, plátano",4500,Comida,true\n' +
      '"Sopa de Mariscos","Con camarones y pescado",6500,Comida,true\n' +
      '"Arroz Integral 1kg","Arroz de grano largo",2800,Tiendas,true\n' +
      '"Aceite de Oliva 500ml","Extra virgen",7500,Tiendas,false\n';

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_productos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Plantilla CSV descargada');
  };

  /* ── Delete history record ────────────────────────────── */
  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    toast.success('Registro eliminado');
  };

  /* ── Status config ────────────────────────────────────── */
  const statusConfig = {
    success: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Exitoso' },
    partial: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Parcial' },
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Error' },
  };

  /* ── Render ──────────────────────────────────────────── */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CSV Import</h1>
          <p className="text-gray-500 text-sm mt-1">Importa productos masivamente desde archivos CSV</p>
        </div>
        <motion.button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Download className="w-4 h-4" />
          Descargar Plantilla
        </motion.button>
      </div>

      {/* Upload Area */}
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !importing && fileInputRef.current?.click()}
        className={`glass rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'glow-cyan border-cyan-500/50'
            : importing
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:glow-cyan'
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />

        <motion.div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center mx-auto mb-6"
          animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
        >
          {importing ? (
            <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-green-600" />
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {importing ? (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto"
            >
              <p className="text-gray-900 font-semibold mb-2">Importando: {importingFile}</p>
              <Progress value={importProgress} className="h-2 mb-2" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-600">Importando... {importProgress}%</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-gray-900 font-semibold mb-1">Arrastra tu archivo CSV aquí</p>
              <p className="text-gray-500 text-sm mb-4">o haz clic para seleccionar</p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-300">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Formato: .CSV
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Máximo: 10MB
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  UTF-8
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CSV Format Guide */}
      <motion.div
        className="glass rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-green-600" />
          Formato del CSV
        </h3>
        <div className="bg-black/30 rounded-xl p-4 overflow-x-auto">
          <code className="text-xs text-gray-500 whitespace-nowrap block">
            nombre,descripcion,precio,categoria,en_stock
            <br />
            &quot;Ibuprofeno 600mg&quot;,&quot;Antiinflamatorio, caja 20 tabletas&quot;,3500,Farmacia,true
            <br />
            &quot;Casado Tradicional&quot;,&quot;Arroz, frijoles, ensalada&quot;,4500,Comida,true
          </code>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <span className="text-[11px] text-gray-400">
            <span className="text-emerald-600 font-medium">Obligatorias:</span> nombre, precio
          </span>
          <span className="text-[11px] text-gray-400">
            <span className="text-gray-500 font-medium">Opcionales:</span> descripcion, categoria, en_stock
          </span>
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !importing && setShowPreview(false)}
            />
            <motion.div
              className="relative w-full max-w-3xl glass-strong rounded-2xl z-10 max-h-[85vh] flex flex-col"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-green-600" />
                    Vista Previa
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">{previewFileName}</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  disabled={importing}
                  className="text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 px-6 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">{validCount} válidos</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs text-red-600 font-medium">{invalidCount} con error</span>
                  </div>
                )}
                <div className="text-xs text-gray-400">{parsedRows.length} filas totales</div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto px-6 mt-4 mb-4">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">#</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Nombre</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Descripción</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Precio</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Categoría</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Stock</th>
                        <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.slice(0, 50).map((r) => (
                        <tr
                          key={r.row}
                          className={r.valid ? 'hover:bg-gray-50' : 'bg-red-50'}
                        >
                          <td className="px-3 py-2 text-gray-300">{r.row}</td>
                          <td className="px-3 py-2 text-gray-900 font-medium">{r.nombre || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">
                            {r.descripcion || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-900">₡{r.precio || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.categoria || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.en_stock || '—'}</td>
                          <td className="px-3 py-2">
                            {r.valid ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="text-red-600" title={r.errors.join(', ')}>
                                ✗ {r.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 50 && (
                    <div className="px-4 py-2 text-[11px] text-gray-400 text-center border-t border-gray-100">
                      ...y {parsedRows.length - 50} filas más
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-6 pt-0">
                <button
                  onClick={() => setShowPreview(false)}
                  disabled={importing}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                {validCount > 0 && (
                  <motion.button
                    onClick={executeImport}
                    disabled={importing}
                    className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    whileHover={{ scale: importing ? 1 : 1.02 }}
                    whileTap={{ scale: importing ? 1 : 0.98 }}
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                    {importing
                      ? `Importando... ${importProgress}%`
                      : `Importar ${validCount} producto${validCount !== 1 ? 's' : ''}`}
                  </motion.button>
                )}
              </div>

              {/* Progress inside modal */}
              {importing && (
                <div className="px-6 pb-4">
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import History */}
      <motion.div
        className="glass rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              Historial de Importaciones
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {history.length === 0
                ? 'Sin importaciones'
                : `${history.length} importación${history.length !== 1 ? 'es' : ''} realizada${history.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => {
                setHistory([]);
                toast.success('Historial limpiado');
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Limpiar historial
            </button>
          )}
        </div>

        <div className="space-y-3">
          {history.map((record, i) => {
            const config = statusConfig[record.status];
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={record.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <div
                  className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <StatusIcon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium truncate">{record.fileName}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.date}
                    </span>
                    <span>{record.totalRows} filas</span>
                    <span className="text-emerald-600">{record.productsImported} importados</span>
                    {record.errors > 0 && (
                      <span className="text-red-600">{record.errors} errores</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                      record.status === 'success'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : record.status === 'partial'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}
                  >
                    {config.label}
                  </span>
                  <button
                    onClick={() => {
                      toast('¿Eliminar este registro?', {
                        action: {
                          label: 'Eliminar',
                          onClick: () => handleDeleteRecord(record.id),
                        },
                      });
                    }}
                    className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {history.length === 0 && (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay importaciones registradas</p>
            <p className="text-xs text-gray-300 mt-1">Sube un archivo CSV para comenzar</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
