import React, { useState, useRef } from 'react';
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

  if (!report) return null;

  const aligned = getAlignedCivicPhoto(report);
  const beforeImage = report.image_url || aligned.beforeUrl;
  const afterImage = report.after_image_url || aligned.afterUrl;

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-scale-up"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <SlidersHorizontal className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold">Compare Before &amp; After Proof</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Fixed &amp; Verified
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700 font-bold">
                Work-Order: {workOrderId || 'GNIDA/Z3/2026/WO-419'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{report.title}</p>
          </div>
          <button
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

          {/* Draggable Comparison Slider */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            className="relative w-full h-80 rounded-2xl overflow-hidden cursor-ew-resize select-none border border-slate-200 shadow-inner bg-slate-900"
          >
            {/* After Image (Background) */}
            <img
              src={afterImage}
              alt="After Remediation"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = aligned.afterUrl;
              }}
            />
            <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-lg bg-emerald-800/95 text-white font-extrabold text-xs tracking-wider uppercase shadow-md pointer-events-none flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>After (Fixed)</span>
            </div>

            {/* Before Image (Clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <img
                src={beforeImage}
                alt="Before Remediation"
                className="absolute inset-0 w-full h-full object-cover max-w-none"
                style={{
                  width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = aligned.beforeUrl;
                }}
              />
              <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-rose-800/95 text-white font-extrabold text-xs tracking-wider uppercase shadow-md pointer-events-none">
                Before (Citizen Hazard)
              </div>
            </div>

            {/* Draggable Divider Handle */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              className="absolute top-0 bottom-0 w-1.5 bg-white cursor-ew-resize shadow-2xl flex items-center justify-center"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-xl border-2 border-amber-500 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                ⇄
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500 font-medium">
            Drag the center divider left or right to compare the citizen hazard photo with the official GNIDA remediation proof
          </div>
        </div>
      </div>
    </div>
  );
};
