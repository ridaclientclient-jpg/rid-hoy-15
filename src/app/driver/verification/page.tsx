'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle, Shield, User, CreditCard, Car,
  ArrowLeft, X, RotateCcw, Image as ImageIcon, Loader2, AlertTriangle, FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/* ─── Step definitions ─────────────────────────────────────── */
const steps = [
  { id: 1, label: 'Selfie', icon: User, description: 'Toma una selfie clara con buena iluminacion', docType: 'selfie' },
  { id: 2, label: 'Cedula Frente', icon: CreditCard, description: 'Fotografa el frente de tu cedula de identidad', docType: 'id_front' },
  { id: 3, label: 'Cedula Atras', icon: CreditCard, description: 'Fotografa el reverso de tu cedula de identidad', docType: 'id_back' },
  { id: 4, label: 'Licencia Frente', icon: CreditCard, description: 'Fotografa el frente de tu licencia de conducir', docType: 'license_front' },
  { id: 5, label: 'Licencia Atras', icon: CreditCard, description: 'Fotografa el reverso de tu licencia de conducir', docType: 'license_back' },
  { id: 6, label: 'Vehiculo', icon: Car, description: 'Fotografa tu vehiculo: frente, lateral, atras e interior', docType: null },
  { id: 7, label: 'Circulacion', icon: FileCheck, description: 'Fotografa la circulacion vehicular', docType: 'circulacion' },
  { id: 8, label: 'Marchamo', icon: FileCheck, description: 'Fotografa el marchamo del vehiculo', docType: 'marchamo' },
];

const vehicleSubPhotos = [
  { id: 'vehicle_front', label: 'Frente del vehiculo' },
  { id: 'vehicle_side', label: 'Lateral del vehiculo' },
  { id: 'vehicle_back', label: 'Atras del vehiculo' },
  { id: 'vehicle_interior', label: 'Interior del vehiculo' },
];

/* ─── All document types for summary ───────────────────────── */
const allDocTypes = [
  { type: 'selfie', label: 'Selfie' },
  { type: 'id_front', label: 'Cedula Frente' },
  { type: 'id_back', label: 'Cedula Atras' },
  { type: 'license_front', label: 'Licencia Frente' },
  { type: 'license_back', label: 'Licencia Atras' },
  { type: 'vehicle_front', label: 'Vehiculo Frente' },
  { type: 'vehicle_side', label: 'Vehiculo Lateral' },
  { type: 'vehicle_back', label: 'Vehiculo Atras' },
  { type: 'vehicle_interior', label: 'Vehiculo Interior' },
  { type: 'circulacion', label: 'Circulacion Vehicular' },
  { type: 'marchamo', label: 'Marchamo' },
];

/* ─── Helpers ──────────────────────────────────────────────── */
function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/* ─── Component ────────────────────────────────────────────── */
export default function DriverVerification() {
  const user = useAuthStore((s) => s.user);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [currentVehiclePhoto, setCurrentVehiclePhoto] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  /* Camera state */
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError('No se pudo acceder a la camara. Usa la opcion de subir imagen.');
      setCameraOpen(false);
      setTimeout(() => fileInputRef.current?.click(), 500);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    setCameraOpen(false);
  }, [stopCamera]);

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen valido');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen no debe superar 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  /* ─── Upload to Supabase Storage + documents table ──────── */
  const uploadDocument = async (docType: string, imageData: string): Promise<boolean> => {
    if (!user) {
      toast.error('Debes iniciar sesion para subir documentos');
      return false;
    }

    setIsUploading(true);
    try {
      /* 1. Convert dataURL → Blob */
      const blob = dataURLtoBlob(imageData);
      const filePath = `${user.id}/${docType}_${Date.now()}.jpg`;

      /* 2. Upload to Supabase Storage */
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message);
        toast.error('Error al subir imagen: ' + uploadError.message);
        setIsUploading(false);
        return false;
      }

      /* 3. Insert / upsert into documents table */
      const { error: insertError } = await supabase
        .from('documents')
        .upsert(
          { user_id: user.id, type: docType, url: filePath, status: 'pending' },
          { onConflict: 'user_id,type' },
        );

      if (insertError) {
        console.error('DB insert error:', insertError.message);
        toast.error('Error al guardar registro: ' + insertError.message);
        setIsUploading(false);
        return false;
      }

      setUploadedDocs((prev) => new Set([...prev, docType]));
      setIsUploading(false);
      return true;
    } catch (err: any) {
      console.error('Upload exception:', err);
      toast.error('Error de conexion al subir documento');
      setIsUploading(false);
      return false;
    }
  };

  /* ─── Handle capture / use-photo ────────────────────────── */
  const handleCapture = async (step: number) => {
    if (!capturedImage) return;

    if (step === 6) {
      /* Vehicle sub-photo */
      const docType = vehicleSubPhotos[currentVehiclePhoto].id;
      const ok = await uploadDocument(docType, capturedImage);
      if (!ok) return;

      setCapturedImage(null);

      if (currentVehiclePhoto < vehicleSubPhotos.length - 1) {
        setCurrentVehiclePhoto((p) => p + 1);
        toast.success(vehicleSubPhotos[currentVehiclePhoto].label + ' subida correctamente');
      } else {
        setCompletedSteps((prev) => new Set([...prev, 6]));
        toast.success('Todas las fotos del vehiculo subidas');
        setCurrentStep(7);
      }
    } else {
      const docType = steps[step - 1].docType!;
      const ok = await uploadDocument(docType, capturedImage);
      if (!ok) return;

      setCapturedImage(null);
      setCompletedSteps((prev) => new Set([...prev, step]));
      toast.success(steps[step - 1].label + ' subido correctamente');

      if (step < steps.length) {
        setTimeout(() => setCurrentStep(step + 1), 500);
      } else {
        /* Last step completed → finalize */
        setIsSubmitted(true);
        /* Update driver status to pending */
        try {
          const { data: drv } = await supabase
            .from('drivers')
            .select('id')
            .eq('user_id', user!.id)
            .single();
          if (drv) {
            await supabase.from('drivers').update({ status: 'pending' }).eq('id', drv.id);
          }
        } catch (e) {
          console.warn('Could not update driver status:', e);
        }
      }
    }
  };

  /* ─── Total documents count ─────────────────────────────── */
  const totalDocs = allDocTypes.length;
  const totalUploaded = uploadedDocs.size;

  /* ═══════════════════════════════════════════════════════════
     SUBMITTED VIEW
     ═══════════════════════════════════════════════════════════ */
  if (isSubmitted) {
    return (
      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Verificacion</h1>
          <p className="text-sm text-gray-400 mt-1">Estado de tu verificacion</p>
        </motion.div>

        {/* Progress */}
        <div className="flex items-center gap-1.5">
          {steps.map((s) => (
            <div key={s.id} className="h-1.5 flex-1 rounded-full bg-emerald-500" />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-8 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          >
            <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto" />
          </motion.div>
          <h2 className="text-xl font-bold text-white">Enviado para Revision</h2>
          <p className="text-sm text-gray-400">
            Todos tus documentos han sido recibidos correctamente.
          </p>
          <p className="text-sm text-gray-400">
            El proceso de verificacion toma entre{' '}
            <span className="text-cyan-400 font-medium">24-48 horas</span>.
          </p>

          <div className="glass rounded-xl p-4 flex items-center gap-3 mt-4">
            <Shield className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-amber-400">Pendiente de revision</p>
              <p className="text-xs text-gray-500">
                Te notificaremos cuando tu cuenta este verificada
              </p>
            </div>
          </div>

          {/* Uploaded documents list */}
          <div className="space-y-1.5 mt-4 text-left">
            <p className="text-xs text-gray-500 mb-2">
              Documentos subidos ({totalUploaded}/{totalDocs}):
            </p>
            {allDocTypes.map((doc) => {
              const isUploaded = uploadedDocs.has(doc.type);
              return (
                <div key={doc.type} className="flex items-center gap-2">
                  {isUploaded ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span
                    className={`text-xs ${isUploaded ? 'text-gray-400' : 'text-red-400'}`}
                  >
                    {doc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     CAPTURE VIEW
     ═══════════════════════════════════════════════════════════ */
  const currentStepData = steps[currentStep - 1];

  return (
    <div className="p-4 space-y-6">
      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Verificacion</h1>
            <p className="text-sm text-gray-400 mt-1">
              Paso {currentStep} de {steps.length}
            </p>
          </div>
          <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">
            {totalUploaded}/{totalDocs} subidos
          </span>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                completedSteps.has(s.id)
                  ? 'bg-emerald-500'
                  : s.id === currentStep
                  ? 'bg-cyan-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {steps.map((s) => (
            <span
              key={s.id}
              className={`text-[9px] ${
                completedSteps.has(s.id)
                  ? 'text-emerald-400'
                  : s.id === currentStep
                  ? 'text-cyan-400'
                  : 'text-gray-600'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep === 6 ? `vehicle-${currentVehiclePhoto}` : currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="glass-strong rounded-2xl p-6 text-center space-y-4"
        >
          {/* Step Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto">
            <currentStepData.icon className="w-8 h-8 text-white" />
          </div>

          {/* Step Title */}
          {currentStep === 6 ? (
            <>
              <h3 className="text-lg font-semibold text-white">
                {vehicleSubPhotos[currentVehiclePhoto].label}
              </h3>
              <p className="text-sm text-gray-400">
                {vehicleSubPhotos[currentVehiclePhoto].label} en buena iluminacion
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white">{currentStepData.label}</h3>
              <p className="text-sm text-gray-400">{currentStepData.description}</p>
            </>
          )}

          {/* Vehicle photo indicator */}
          {currentStep === 6 && (
            <div className="flex items-center justify-center gap-2">
              {vehicleSubPhotos.map((photo, i) => (
                <div
                  key={photo.id}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    uploadedDocs.has(photo.id)
                      ? 'bg-emerald-500'
                      : i === currentVehiclePhoto
                      ? 'bg-cyan-500'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* ─── Camera / Preview Area ──────────────────── */}
          {isUploading ? (
            /* Uploading spinner */
            <div className="w-56 h-56 mx-auto rounded-2xl border-2 border-dashed border-cyan-500/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <span className="text-sm text-cyan-400 font-medium">Subiendo documento...</span>
              <span className="text-xs text-gray-500">Por favor espera</span>
            </div>
          ) : capturedImage ? (
            /* Show captured image */
            <div className="w-64 h-64 mx-auto rounded-2xl overflow-hidden relative">
              <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex justify-center gap-3">
                <button
                  onClick={retakePhoto}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retomar
                </button>
                <button
                  onClick={() => handleCapture(currentStep)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Usar foto
                </button>
              </div>
            </div>
          ) : cameraOpen ? (
            /* Live camera view */
            <div className="w-64 h-64 mx-auto rounded-2xl overflow-hidden relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-14 h-14 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
                </button>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setCameraOpen(false);
                }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            /* Capture options */
            <div className="w-56 h-56 mx-auto border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500/50 transition-colors">
              <button
                onClick={startCamera}
                className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center hover:bg-cyan-500/20 transition-colors active:scale-90"
              >
                <Camera className="w-7 h-7 text-cyan-400" />
              </button>
              <span className="text-xs text-gray-400">Abrir camara</span>

              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-gray-600">o</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors active:scale-90"
              >
                <ImageIcon className="w-7 h-7 text-gray-400" />
              </button>
              <span className="text-xs text-gray-500">Subir imagen</span>

              {cameraError && (
                <p className="text-[10px] text-amber-400 mt-1 px-3">{cameraError}</p>
              )}
            </div>
          )}

          {/* Back Button (vehicle sub-photos) */}
          {currentStep === 6 && currentVehiclePhoto > 0 && !capturedImage && !cameraOpen && !isUploading && (
            <button
              onClick={() => setCurrentVehiclePhoto((prev) => prev - 1)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3 h-3" /> Foto anterior
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Step Navigation */}
      <div className="flex gap-3">
        {currentStep > 1 && !completedSteps.has(currentStep) && !isUploading && (
          <button
            onClick={() => {
              if (currentStep === 6 && currentVehiclePhoto > 0) {
                setCurrentVehiclePhoto(0);
                return;
              }
              setCurrentStep((prev) => prev - 1);
            }}
            className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" /> Atras
          </button>
        )}
        {completedSteps.has(currentStep) && currentStep < steps.length && (
          <button
            onClick={() => setCurrentStep((prev) => prev + 1)}
            className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
          >
            Siguiente
          </button>
        )}
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-4 border border-cyan-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Consejos</span>
        </div>
        <ul className="space-y-1.5">
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Usa buena iluminacion y evita reflejos
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Asegurate que todos los textos sean legibles
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Los documentos no deben estar vencidos
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Las fotos del vehiculo deben mostrar la placa claramente
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
