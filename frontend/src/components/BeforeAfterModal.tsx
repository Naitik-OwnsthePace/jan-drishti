import React, { useState, useRef, useEffect } from 'react';
import type { Report } from '../types';
import { getAlignedCivicPhoto } from '../utils/civicPhotos';
import { X, CheckCircle2, Calendar, MapPin, SlidersHorizontal } from 'lucide-react';

interface BeforeAfterModalProps {
  report: Report | null;
  workOrderId?: string;
  onClose: () => void;
}

export const BeforeAfterModal: React.FC<BeforeAfterModalProps> = ({
  report,
  workOrderId,
  onClose,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  useEffect(() => {
    setSliderPosition(50);
  }, [report?.id]);

  useEffect(() => {
    if (!report) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [report, onClose]);

  if (!report) return null;

  const aligned = getAlignedCivicPhoto(report);
  const beforeImage = report.image_url || aligned.beforeUrl;
  const afterImage = report.after_image_url || aligned.afterUrl;
  const displayWo = workOrderId || report.work_order_id || 'GNIDA/Z3/2026/WO-419';

  const updateFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    updateFromClientX(e.clientX);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    updateFromClientX(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]) {
      updateFromClientX(e.touches[0].clientX);
    }
  };

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in overscroll-contain"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="before-after-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-scale-up overscroll-contain"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <SlidersHorizontal className="w-5 h-5" />
              </span>
              <h2 id="before-after-modal-title" className="text-base font-bold">
                Compare Before &amp; After Proof
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Fixed &amp; Verified
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700 font-bold">
                Work-Order: {displayWo}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{report.title}</p>
          </div>
          <button
            type="button"
            aria-label="Close Before and After comparison modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {report.locality} ({report.lat.toFixed(4)}°N, {report.lng.toFixed(4)}°E)
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Verified Fixed:{' '}
                {report.resolved_at
                  ? new Date(report.resolved_at).toLocaleString()
                  : 'GNIDA Field Crew Confirmed'}
              </span>
            </div>
          </div>

          {/* Draggable Comparison Slider (uses CSS clip-path so Before image never squishes on initial mount) */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchMove}
            onTouchMove={handleTouchMove}
            className="relative w-full h-80 rounded-2xl overflow-hidden cursor-ew-resize select-none border border-slate-200 shadow-inner bg-slate-900"
          >
            {/* After Image (Full Background) */}
            <img
              src={afterImage}
              alt="After Remediation"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = aligned.afterUrl;
              }}
            />
            <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-lg bg-emerald-800/95 text-white font-extrabold text-xs tracking-wider uppercase shadow-md pointer-events-none flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>After (Fixed)</span>
            </div>

            {/* Before Image (Full Width, Clipped Cleanly via CSS inset) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={beforeImage}
                alt="Before Remediation"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = aligned.beforeUrl;
                }}
              />
              <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-rose-800/95 text-white font-extrabold text-xs tracking-wider uppercase shadow-md">
                Before (Citizen Hazard)
              </div>
            </div>

            {/* Draggable Divider Line & Handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl flex items-center justify-center pointer-events-none"
              style={{ left: `calc(${sliderPosition}% - 2px)` }}
            >
              <div className="w-9 h-9 rounded-full bg-white shadow-xl border-2 border-amber-500 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                ⇄
              </div>
            </div>

            {/* Accessible Keyboard Slider Overlay */}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sliderPosition)}
              aria-label="Before and after remediation comparison slider"
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="sr-only"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 font-medium gap-2 flex-wrap">
            <span>
              Click or drag anywhere across the split frame to compare citizen hazard evidence vs. GNIDA remediation proof
            </span>
            <span className="font-mono font-bold text-slate-700 tabular-nums">
              Split: {Math.round(sliderPosition)}% / {100 - Math.round(sliderPosition)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
