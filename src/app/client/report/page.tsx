'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, ImagePlus, X, Send, AlertTriangle, Shield, User as UserIcon, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const reportTypes = [
  { id: 'incident', label: 'Incidente', icon: AlertTriangle, color: 'text-red-400 bg-red-500/20' },
  { id: 'complaint', label: 'Queja', icon: MessageSquare, color: 'text-amber-400 bg-amber-500/20' },
  { id: 'driver_report', label: 'Reportar conductor', icon: UserIcon, color: 'text-cyan-400 bg-cyan-500/20' },
  { id: 'fraud', label: 'Fraude', icon: Shield, color: 'text-purple-400 bg-purple-500/20' },
];

export default function ClientReportPage() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length && images.length < 3; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagen muy grande (max 5MB)');
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!type) {
      toast.error('Selecciona el tipo de reporte');
      return;
    }
    if (description.length < 10) {
      toast.error('La descripcion debe tener al menos 10 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          type,
          description,
          images: images.length > 0 ? images : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Reporte enviado', {
          description: 'Los administradores revisaran tu reporte pronto.',
        });
        router.back();
      } else {
        throw new Error(data.error || 'Error al enviar reporte');
      }
    } catch (err: any) {
      toast.error('Error al enviar reporte', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Reportar</h1>
          <p className="text-sm text-gray-400">Describe la situacion</p>
        </div>
      </div>

      {/* Type Selection */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-3">Tipo de reporte</p>
        <div className="grid grid-cols-2 gap-2">
          {reportTypes.map((rt) => (
            <button
              key={rt.id}
              onClick={() => setType(rt.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                type === rt.id
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rt.color} mb-2`}>
                <rt.icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-white">{rt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-2">Descripcion</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe lo que sucedio con el mayor detalle posible..."
          maxLength={2000}
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/2000</p>
      </div>

      {/* Images */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-2">Fotos (opcional, max 3)</p>
        <div className="flex gap-2 flex-wrap">
          {images.map((img, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
              <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <button
              onClick={handleImageUpload}
              className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 hover:border-cyan-500/30 transition-colors"
            >
              <ImagePlus className="w-5 h-5 text-gray-500" />
              <span className="text-[10px] text-gray-500">Agregar</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <motion.button
        onClick={handleSubmit}
        disabled={isSubmitting || !type || description.length < 10}
        className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        whileTap={{ scale: 0.98 }}
      >
        {isSubmitting ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
        ) : (
          <><Send className="w-4 h-4" /> Enviar Reporte</>
        )}
      </motion.button>
    </div>
  );
}
