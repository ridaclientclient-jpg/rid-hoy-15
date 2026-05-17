'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle, Shield, User, CreditCard,
  X, RotateCcw, Image as ImageIcon, Loader2, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/* ─── Steps ──────────────────────────────────────────────── */
const steps = [
  { id: 1, label: 'Selfie', icon: User, description: 'Toma una selfie clara con buena iluminacion. Tu rostro debe ser visible de frente.', docType: 'selfie' },
  { id: 2, label: 'Cedula Frente', icon: CreditCard, description: 'Fotografa el frente de tu cedula de identidad. Todos los textos deben ser legibles.', docType: 'id_front' },
  { id: 3, label: 'Cedula Atras', icon: CreditCard, description: 'Fotografa el reverso de tu cedula de identidad.', docType: 'id_back' },
];

const allDocTypes = [
  { type: 'selfie', label: 'Selfie' },
  { type: 'id_front', label: 'Cedula Frente' },
  { type: 'id_back', label: 'Cedula Atras' },
];

/* ─── Helpers ────────────────────────────────────────────── */
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

/* ─── Component ──────────────────────────────────────────── */
export default function ClientVerification() {
  const user = useAuthStore((s) => s.user);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [existingDocs, setExistingDocs] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  /* Camera state */
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ─── Load existing documents on mount ────────────────── */
  useEffect(() => {
    const loadDocs = async () => {
      if (!user) { setIsLoadingDocs(false); return; }
      try {
        const { data } = await supabase
          .from('documents')
          .select('type, status')
          .eq('user_id', user.id);
        if (data && data.length > 0) {
          const docs = new Set<string>();
          const completed = new Set<number>();
          data.forEach((d) => {
            docs.add(d.type);
            const stepIdx = steps.findIndex((s) => s.docType === d.type);
            if (stepIdx >= 0) completed.add(stepIdx + 1);
          });
          setExistingDocs(docs);
          setUploadedDocs(docs);
          setCompletedSteps(completed);

          /* Check if already submitted / verified */
          const hasAll = allDocTypes.every((d) => docs.has(d.type));
          if (hasAll) {
            const firstDoc = data.find((d) => d.status);
            if (firstDoc?.status === 'approved') {
              setVerificationStatus('approved');
              setIsSubmitted(true);
            } else if (firstDoc?.status === 'pending') {
              setVerificationStatus('pending');
              setIsSubmitted(true);
            } else if (firstDoc?.status === 'rejected') {
              setVerificationStatus('rejected');
            }
          }
        }
      } catch (err) {
        console.warn('Could not load existing documents:', err);
      }
      setIsLoadingDocs(false);
    };
    loadDocs();
  }, [user]);

  /* ─── Camera controls ──────────────────────────────────── */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async (useFront = true) => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: useFront ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
    startCamera(currentStep === 1);
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

  /* ─── Upload to Supabase ──────────────────────────────── */
  const uploadDocument = async (docType: string, imageData: string): Promise<boolean> => {
    if (!user) {
      toast.error('Debes iniciar sesion para subir documentos');
      return false;
    }

    setIsUploading(true);
    try {
      const blob = dataURLtoBlob(imageData);
      const filePath = `${user.id}/client_${docType}_${Date.now()}.jpg`;

      /* Upload to Supabase Storage */
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message);
        toast.error('Error al subir imagen: ' + uploadError.message);
        setIsUploading(false);
        return false;
      }

      /* Insert / upsert into documents table */
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

  /* ─── Handle capture confirm ──────────────────────────── */
  const handleConfirmCapture = async (step: number) => {
    if (!capturedImage) return;

    const docType = steps[step - 1].docType!;
    const ok = await uploadDocument(docType, capturedImage);
    if (!ok) return;

    setCapturedImage(null);
    setCompletedSteps((prev) => new Set([...prev, step]));
    toast.success(steps[step - 1].label + ' subido correctamente');

    if (step < steps.length) {
      setTimeout(() => setCurrentStep(step + 1), 500);
    } else {
      /* All done — auto-approve immediately */
      try {
        /* Mark all documents as approved */
        await supabase
          .from('documents')
          .update({ status: 'approved' })
          .eq('user_id', user!.id)
          .in('type', allDocTypes.map((d) => d.type));

        /* Update profile is_verified */
        await supabase
          .from('profiles')
          .update({ is_verified: true })
          .eq('id', user!.id);

        /* Refresh auth store to reflect verified status */
        useAuthStore.getState().initAuth();
      } catch (err) {
        console.warn('Auto-approve error:', err);
      }
      setIsSubmitted(true);
      setVerificationStatus('approved');
    }
  };

  const totalDocs = allDocTypes.length;
  const totalUploaded = uploadedDocs.size;

  /* ─── Loading state ───────────────────────────────────── */
  if (isLoadingDocs) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     SUBMITTED / APPROVED VIEW
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
            {verificationStatus === 'approved' ? (
              <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto" />
            ) : (
              <Shield className="w-20 h-20 text-amber-400 mx-auto" />
            )}
          </motion.div>

          {verificationStatus === 'approved' ? (
            <>
              <h2 className="text-xl font-bold text-white">Cuenta Verificada</h2>
              <p className="text-sm text-gray-400">
                Tu identidad ha sido verificada exitosamente. Ya tienes acceso completo a la plataforma.
              </p>
              <div className="glass rounded-xl p-4 flex items-center gap-3 mt-4">
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-emerald-400">Verificacion aprobada</p>
                  <p className="text-xs text-gray-500">Tu cuenta esta completamente verificada</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white">Enviado para Revision</h2>
              <p className="text-sm text-gray-400">
                Todos tus documentos han sido recibidos correctamente.
                El proceso de verificacion toma entre{' '}
                <span className="text-cyan-400 font-medium">24-48 horas</span>.
              </p>
              <div className="glass rounded-xl p-4 flex items-center gap-3 mt-4">
                <Shield className="w-6 h-6 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-amber-400">Pendiente de revision</p>
                  <p className="text-xs text-gray-500">Te notificaremos cuando tu cuenta este verificada</p>
                </div>
              </div>
            </>
          )}

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
                  <span className={`text-xs ${isUploaded ? 'text-gray-400' : 'text-red-400'}`}>
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
  const isSelfie = currentStep === 1;

  return (
    <div className="p-4 space-y-6">
      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={isSelfie ? 'user' : 'environment'}
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
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="glass-strong rounded-2xl p-6 text-center space-y-4"
        >
          {/* Step Icon */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto ${
            isSelfie
              ? 'from-purple-600 to-pink-500'
              : 'from-blue-600 to-cyan-500'
          }`}>
            <currentStepData.icon className="w-8 h-8 text-white" />
          </div>

          {/* Step Title */}
          <h3 className="text-lg font-semibold text-white">{currentStepData.label}</h3>
          <p className="text-sm text-gray-400">{currentStepData.description}</p>

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
                  onClick={() => handleConfirmCapture(currentStep)}
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
              {/* Selfie guide overlay */}
              {isSelfie && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-44 rounded-full border-2 border-white/30" />
                </div>
              )}
              {/* Capture button */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-14 h-14 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
                </button>
              </div>
              {/* Close camera */}
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
          ) : completedSteps.has(currentStep) ? (
            /* Already completed step */
            <div className="w-56 h-56 mx-auto rounded-2xl border-2 border-emerald-500/30 flex flex-col items-center justify-center gap-3 bg-emerald-500/5">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Documento subido</span>
            </div>
          ) : (
            /* Capture options - default state */
            <div className="w-56 h-56 mx-auto border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500/50 transition-colors">
              {/* Camera button */}
              <button
                onClick={() => startCamera(isSelfie)}
                className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center hover:bg-cyan-500/20 transition-colors active:scale-90"
              >
                <Camera className="w-7 h-7 text-cyan-400" />
              </button>
              <span className="text-xs text-gray-400">
                {isSelfie ? 'Abrir camara frontal' : 'Abrir camara'}
              </span>

              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-gray-600">o</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Upload button */}
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
        </motion.div>
      </AnimatePresence>

      {/* Step Navigation */}
      <div className="flex gap-3">
        {currentStep > 1 && !completedSteps.has(currentStep) && !isUploading && (
          <button
            onClick={() => setCurrentStep((prev) => prev - 1)}
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
        {isSelfie ? (
          <ul className="space-y-1.5">
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Asegurate de tener buena iluminacion en tu rostro
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Muestrate de frente, sin gafas de sol ni gorra
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Evita sombras y reflejos en tu rostro
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              La foto debe mostrar solo tu rostro, de preferencia de hombros hacia arriba
            </li>
          </ul>
        ) : (
          <ul className="space-y-1.5">
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Coloca el documento sobre una superficie plana
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Asegurate que todos los textos sean legibles
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              Evita sombras y reflejos sobre el documento
            </li>
            <li className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">&#8226;</span>
              El documento no debe estar recortado ni cortado en la foto
            </li>
          </ul>
        )}
      </motion.div>
    </div>
  );
}
