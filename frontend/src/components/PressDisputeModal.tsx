import React, { useState, useRef } from 'react';
import type { Report } from '../types';
import {
  getAlignedCivicPhoto,
  compressImageFileToDataUrl,
} from '../utils/civicPhotos';
import {
  X,
  AlertOctagon,
  Newspaper,
  CheckCircle2,
  Camera,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface PressDisputeModalProps {
  report: Report | null;
  journalistTrustScore: number;
  openDisputesCount: number;
  onClose: () => void;
  onConfirmDispute: (
    reportId: string,
    reason: string,
    counterPhotoUrl: string,
    counterPhotoName: string
  ) => void;
}

const PRESET_DISPUTE_REASONS = [
  'Field re-inspection confirms cosmetic patchwork only; underlying hazard remains active on-site.',
  'Debris/waste was merely pushed to the adjacent service lane instead of sanitary removal.',
  'Submitted After-photo angle obscures uninsulated high-voltage feeder cables.',
];

export const PressDisputeModal: React.FC<PressDisputeModalProps> = ({
  report,
  journalistTrustScore,
  openDisputesCount,
  onClose,
  onConfirmDispute,
}) => {
  const [reason, setReason] = useState<string>(PRESET_DISPUTE_REASONS[0]);
  const [counterPhotoUrl, setCounterPhotoUrl] = useState<string | null>(null);
  const [counterPhotoName, setCounterPhotoName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!report) return null;

  const isEligibleTrust = journalistTrustScore >= 65;
  const isUnderQuota = openDisputesCount < 3;
  const canDispute = isEligibleTrust && isUnderQuota;
  const aligned = getAlignedCivicPhoto(report);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setCounterPhotoName(f.name);
      try {
        const compressed = await compressImageFileToDataUrl(f, 900, 0.8);
        setCounterPhotoUrl(compressed);
      } catch {
        setCounterPhotoUrl(URL.createObjectURL(f));
      }
    }
  };

  const handleLoadSampleCounterPhoto = () => {
    setCounterPhotoUrl(aligned.beforeUrl);
    setCounterPhotoName(`Press_OnSite_CounterEvidence_${report.id.substring(0, 6)}.jpg`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDispute) return;
    const finalReason = reason.trim() || PRESET_DISPUTE_REASONS[0];
    const finalPhoto = counterPhotoUrl || aligned.beforeUrl;
    const finalName =
      counterPhotoName || `Press_CounterProof_${report.id.substring(0, 6)}.jpg`;
    onConfirmDispute(report.id, finalReason, finalPhoto, finalName);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-lg max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-rose-300 animate-scale-up"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B1120] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold">
                  Press Dispute &amp; Counter-Evidence (#JD-204)
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-black">
                  Trust {journalistTrustScore}/100
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                Challenging Authority Resolution: {report.locality}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Anti-Abuse Trust Staking Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-xs text-slate-900 space-y-1.5">
            <div className="font-black uppercase tracking-wider text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Staking -10 Trust if rejected; +15 Trust if upheld</span>
              </span>
              <span className="font-mono text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded">
                Quota: {openDisputesCount}/3 Open
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Submitting places this ticket into <strong>Under Dispute Review</strong>, unlocks an{' '}
              <strong>Authority Right of Reply</strong>, and routes the case to a{' '}
              <strong>Reviewer (Truth Engine Auditor)</strong> for final adjudication.
            </p>
          </div>

          {!canDispute && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 font-bold">
              {!isEligibleTrust
                ? `Dispute Blocked: Journalist Trust Score (${journalistTrustScore}/100) is below the required 65/100 threshold.`
                : 'Dispute Blocked: Maximum 3 concurrent active disputes reached. Await Reviewer adjudication.'}
            </div>
          )}

          {/* 1. Written Reason */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              1. Quick Audit Findings (Click to Select):
            </label>
            <div className="space-y-1.5">
              {PRESET_DISPUTE_REASONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all flex items-start gap-2 ${
                    reason === preset
                      ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      reason === preset ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Written Press Challenge Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
              placeholder="Enter detailed reason for disputing the authority's After-photo..."
              required
            />
          </div>

          {/* 2. Counter-Photo Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                2. Required On-Site Counter-Photo Evidence <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleLoadSampleCounterPhoto}
                className="text-xs font-extrabold text-rose-700 hover:text-rose-900 flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Load Field Counter-Photo</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {counterPhotoUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-rose-500 bg-slate-900 h-36">
                <img
                  src={counterPhotoUrl}
                  alt="Press Counter Evidence"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-white px-3 py-1.5 text-xs font-mono flex items-center justify-between">
                  <span className="truncate text-amber-300">📷 {counterPhotoName}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs underline text-slate-300 hover:text-white ml-2"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-rose-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-rose-50/20 transition-all"
              >
                <Camera className="w-6 h-6 text-rose-600 mx-auto mb-1" />
                <div className="text-xs font-extrabold text-slate-800">
                  Upload Journalist Counter-Photo (or click 1-Click Load above)
                </div>
                <div className="text-xs text-slate-500">
                  Required to stake Trust Score and enter Reviewer Dispute Arbitration
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canDispute || !counterPhotoUrl}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Newspaper className="w-4 h-4" />
              <span>Stake Trust &amp; Submit Dispute</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
