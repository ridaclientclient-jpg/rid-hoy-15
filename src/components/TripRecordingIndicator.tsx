'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Video, MapPin } from 'lucide-react';

interface TripRecordingIndicatorProps {
  isRecording: boolean;
  pointCount: number;
  elapsed?: string;
}

export default function TripRecordingIndicator({
  isRecording,
  pointCount,
  elapsed,
}: TripRecordingIndicatorProps) {
  return (
    <AnimatePresence>
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="glass-strong rounded-full px-4 py-2 flex items-center gap-2.5 border border-red-500/30">
            {/* Recording dot */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">REC</span>
            </div>

            {/* Separator */}
            <div className="w-px h-3 bg-white/10" />

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-medium text-white">{pointCount} pts</span>
              </div>
              {elapsed && (
                <div className="flex items-center gap-1">
                  <Video className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-medium text-white">{elapsed}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
