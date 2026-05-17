'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DraggableBottomSheetProps {
  children: React.ReactNode;
  /** Initial snap position: 'peek' (small), 'half' (50%), or 'full' (90%) */
  initialSnap?: 'peek' | 'half' | 'full';
  /** Minimum height when collapsed (px) */
  minHeight?: number;
  /** Enable drag to dismiss (set to false to prevent closing) */
  dismissible?: boolean;
  /** Callback when sheet is dismissed */
  onDismiss?: () => void;
  className?: string;
}

const SNAP_POSITIONS = {
  peek: 180,   // Small peek - show just the inputs
  half: 0.5,   // 50% of viewport
  full: 0.92,  // 92% of viewport (almost full screen)
};

export default function DraggableBottomSheet({
  children,
  initialSnap = 'peek',
  minHeight = 120,
  dismissible = true,
  onDismiss,
  className = '',
}: DraggableBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const isDragging = useRef(false);
  const lastVelocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);

  const [sheetHeight, setSheetHeight] = useState(() => {
    if (typeof window === 'undefined') return minHeight;
    const snap = SNAP_POSITIONS[initialSnap];
    return typeof snap === 'number' ? snap : snap * window.innerHeight;
  });
  const [isAtTop, setIsAtTop] = useState(false);

  // Get snap targets in pixels
  const getSnapTargets = useCallback(() => {
    const vh = window.innerHeight;
    return {
      peek: Math.max(minHeight, SNAP_POSITIONS.peek),
      half: SNAP_POSITIONS.half * vh,
      full: SNAP_POSITIONS.full * vh,
      dismiss: 0,
    };
  }, [minHeight]);

  // Find nearest snap point
  const findNearestSnap = useCallback((height: number) => {
    const snaps = getSnapTargets();
    const targets = dismissible ? [snaps.peek, snaps.half, snaps.full, snaps.dismiss] : [snaps.peek, snaps.half, snaps.full];

    let nearest = targets[0];
    let minDist = Math.abs(height - targets[0]);

    for (const target of targets) {
      const dist = Math.abs(height - target);
      if (dist < minDist) {
        minDist = dist;
        nearest = target;
      }
    }
    return nearest;
  }, [getSnapTargets, dismissible]);

  // Animate to snap point
  const animateToSnap = useCallback((targetHeight: number) => {
    if (!sheetRef.current) return;

    sheetRef.current.style.transition = 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
    setSheetHeight(targetHeight);
    setIsAtTop(targetHeight >= getSnapTargets().full - 20);

    setTimeout(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transition = '';
      }
      if (targetHeight <= 5 && onDismiss) {
        onDismiss();
      }
    }, 320);
  }, [getSnapTargets, onDismiss]);

  // Double-tap to toggle between peek and full
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const snaps = getSnapTargets();
      if (sheetHeight >= snaps.full - 20) {
        animateToSnap(snaps.peek);
      } else {
        animateToSnap(snaps.full);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [sheetHeight, getSnapTargets, animateToSnap]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragStartHeight.current = sheetHeight;
    isDragging.current = false;
    lastY.current = touch.clientY;
    lastTime.current = Date.now();
    lastVelocity.current = 0;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaY = dragStartY.current - touch.clientY;
    const currentHeight = dragStartHeight.current + deltaY;

    isDragging.current = true;

    // Calculate velocity for fling detection
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      lastVelocity.current = (lastY.current - touch.clientY) / dt * 1000; // px/s
    }
    lastY.current = touch.clientY;
    lastTime.current = now;

    // Clamp height
    const minHeightFinal = Math.max(0, currentHeight);
    setSheetHeight(minHeightFinal);
    setIsAtTop(minHeightFinal >= getSnapTargets().full - 20);
  }, [getSnapTargets]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Use velocity for fling detection
    const velocity = lastVelocity.current;
    const snaps = getSnapTargets();

    if (velocity > 500) {
      // Fast upward fling -> go to next higher snap
      if (sheetHeight < snaps.peek + 50) {
        animateToSnap(snaps.half);
      } else if (sheetHeight < snaps.half + 50) {
        animateToSnap(snaps.full);
      } else {
        animateToSnap(snaps.full);
      }
    } else if (velocity < -500) {
      // Fast downward fling -> go to next lower snap
      if (sheetHeight > snaps.half) {
        animateToSnap(snaps.half);
      } else if (sheetHeight > snaps.peek + 30) {
        animateToSnap(snaps.peek);
      } else if (dismissible) {
        animateToSnap(snaps.dismiss);
      } else {
        animateToSnap(snaps.peek);
      }
    } else {
      // No fling -> snap to nearest
      animateToSnap(findNearestSnap(sheetHeight));
    }
  }, [sheetHeight, getSnapTargets, animateToSnap, findNearestSnap, dismissible]);

  // Mouse handlers for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = sheetHeight;
    isDragging.current = false;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    lastVelocity.current = 0;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = dragStartY.current - ev.clientY;
      const currentHeight = dragStartHeight.current + deltaY;
      isDragging.current = true;

      const now = Date.now();
      const dt = now - lastTime.current;
      if (dt > 0) {
        lastVelocity.current = (lastY.current - ev.clientY) / dt * 1000;
      }
      lastY.current = ev.clientY;
      lastTime.current = now;

      setSheetHeight(Math.max(0, currentHeight));
      setIsAtTop(currentHeight >= getSnapTargets().full - 20);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!isDragging.current) return;
      isDragging.current = false;

      const velocity = lastVelocity.current;
      const snaps = getSnapTargets();

      if (velocity > 500) {
        if (sheetHeight < snaps.peek + 50) {
          animateToSnap(snaps.half);
        } else if (sheetHeight < snaps.half + 50) {
          animateToSnap(snaps.full);
        } else {
          animateToSnap(snaps.full);
        }
      } else if (velocity < -500) {
        if (sheetHeight > snaps.half) {
          animateToSnap(snaps.half);
        } else if (sheetHeight > snaps.peek + 30) {
          animateToSnap(snaps.peek);
        } else if (dismissible) {
          animateToSnap(snaps.dismiss);
        } else {
          animateToSnap(snaps.peek);
        }
      } else {
        animateToSnap(findNearestSnap(sheetHeight));
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sheetHeight, getSnapTargets, animateToSnap, findNearestSnap, dismissible]);

  // Prevent body scroll when dragging
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      if (isDragging.current) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventScroll);
  }, []);

  if (sheetHeight <= 5) return null;

  return (
    <div
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 z-40 ${className}`}
      style={{
        height: `${sheetHeight}px`,
        maxHeight: '95vh',
        touchAction: 'none',
      }}
    >
      {/* Drag handle area */}
      <div
        className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleDoubleTap}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 hover:bg-cyan-400/50 transition-colors" />
      </div>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="overflow-y-auto overflow-x-hidden"
        style={{
          height: 'calc(100% - 24px)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>

      {/* Quick toggle buttons */}
      <button
        onClick={() => {
          const snaps = getSnapTargets();
          if (sheetHeight >= snaps.full - 20) {
            animateToSnap(snaps.peek);
          } else {
            animateToSnap(snaps.full);
          }
        }}
        className="absolute top-2 right-3 z-10 w-7 h-7 rounded-full glass-strong flex items-center justify-center text-gray-400 hover:text-cyan-400 transition-colors"
      >
        {isAtTop ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
    </div>
  );
}
