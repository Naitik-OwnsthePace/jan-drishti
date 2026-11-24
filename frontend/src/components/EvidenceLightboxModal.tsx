import React, { useState } from 'react';
import type { Report } from '../types';
import { X, Smartphone, Navigation, Calendar, Hash, Copy, Check, MapPin, ShieldCheck, AlertCircle } from 'lucide-react';

interface EvidenceLightboxModalProps {
  report: Report | null;
  onClose: () => void;
}

export const EvidenceLightboxModal: React.FC<EvidenceLightboxModalProps> = ({ report, onClose }) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!report) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(report.evidence_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-700/50 animate-scale-up"
      >
        {/* Left Side: Photo Canvas */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 relative min-h-[300px] md:min-h-[500px]">
          <img
            src={report.image_url}
            alt={report.title}
            className="max-h-[82vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-900/80 text-white text-xs font-mono backdrop-blur-sm border border-slate-700">
              ORIGINAL EVIDENCE
            </span>
            {report.exif_verified ? (
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/90 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                ✔ Real Camera GPS
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md bg-amber-500/90 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                ⚠ Location Mismatch
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Forensics & Metadata Panel */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-900 text-slate-100 p-5 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-slate-800">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  {report.category} • SEVERITY {report.severity}/10
                </span>
                <h3 className="font-bold text-sm text-white leading-snug line-clamp-2">
                  {report.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary */}
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-800">
              {report.summary}
            </p>

            {/* Forensic Telemetry Strip */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Forensic Hardware Telemetry</span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2 text-[11px]">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-sans">Camera Device:</span>
                  <span className="font-bold text-white">
                    {report.exif_metadata?.device || 'EXIF Stripped / Web Upload'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-sans">Timestamp:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{report.exif_metadata?.captured_at || new Date(report.created_at).toLocaleString()}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-sans">Reported Locality:</span>
                  <span className="flex items-center gap-1 font-bold text-indigo-300">
                    <MapPin className="w-3 h-3 text-indigo-400" />
                    <span>{report.locality}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-sans">GPS Pin:</span>
                  <span>{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
                </div>

                {report.exif_metadata?.distance_offset_m !== null && report.exif_metadata?.distance_offset_m !== undefined && (
                  <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500 font-sans">Photo Offset:</span>
                    <span className="flex items-center gap-1 font-bold text-emerald-400">
                      <Navigation className="w-3 h-3 text-emerald-400" />
                      <span>{report.exif_metadata.distance_offset_m} meters</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cryptographic SHA-256 Proof */}
            <div className="space-y-1.5 font-mono">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-indigo-400" />
                <span>SHA-256 Evidence Seal</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 break-all select-all flex items-center justify-between gap-2">
                <span>{report.evidence_hash}</span>
                <button
                  onClick={handleCopyHash}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white shrink-0 transition-colors"
                  title="Copy Hash"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              onClick={onClose}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
