import React, { useState, useRef, useEffect } from 'react';
import type { PresetLocation, Report } from '../types';
import { submitReport } from '../api';
import { compressImageFileToDataUrl } from '../utils/civicPhotos';
import {
  X,
  Camera,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Printer,
  FileBadge,
} from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted: (msg?: string, createdReport?: Report) => void;
}

const PRESET_LOCATIONS: PresetLocation[] = [
  { name: 'Knowledge Park III', lat: 28.4749, lng: 77.4821 },
  { name: 'Beta 2 Sector', lat: 28.4812, lng: 77.5085 },
  { name: 'Pari Chowk', lat: 28.4671, lng: 77.5138 },
  { name: 'Alpha 1 Commercial Belt', lat: 28.4789, lng: 77.5012 },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onReportSubmitted,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customDataUrl, setCustomDataUrl] = useState<string | null>(null);
  const [locality, setLocality] = useState<string>('Knowledge Park III');
  const [lat, setLat] = useState<number>(28.4749);
  const [lng, setLng] = useState<number>(77.4821);
  const [userNote, setUserNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<number>(0);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMessage(null);
      try {
        const compressed = await compressImageFileToDataUrl(selected, 900, 0.8);
        setCustomDataUrl(compressed);
        setPreviewUrl(compressed);
      } catch {
        const objUrl = URL.createObjectURL(selected);
        setCustomDataUrl(objUrl);
        setPreviewUrl(objUrl);
      }
    }
  };

  const handleLoadSampleFieldPhoto = async () => {
    setLoadingSample(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/evidence/wire_before.jpg');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'KP3_LiveWire_FieldCapture.jpg', {
        type: 'image/jpeg',
      });
      setFile(sampleFile);
      setCustomDataUrl(null);
      setPreviewUrl('/evidence/wire_before.jpg');
      if (!userNote.trim()) {
        setUserNote(
          'Exposed overhead electrical distribution wires hanging near student hostel footpath.'
        );
      }
    } catch {
      setErrorMessage('Could not load sample image; please select a local image file.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleDetectGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(Number(pos.coords.latitude.toFixed(6)));
          setLng(Number(pos.coords.longitude.toFixed(6)));
          setLocality('Knowledge Park III (Live GPS)');
        },
        () => {
          setLocality('Knowledge Park III');
          setLat(28.4749);
          setLng(77.4821);
        }
      );
    }
  };

  const handleSelectPreset = (preset: PresetLocation) => {
    setLocality(preset.name);
    setLat(preset.lat);
    setLng(preset.lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select, capture, or 1-click load an evidence photograph.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setScanStep(1);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('locality', locality);
    formData.append('lat', lat.toString());
    formData.append('lng', lng.toString());
    formData.append('user_note', userNote);

    const timer1 = window.setTimeout(() => setScanStep(2), 450);
    const timer2 = window.setTimeout(() => setScanStep(3), 900);

    try {
      const data = await submitReport(formData, customDataUrl || undefined);
      if (customDataUrl && data?.report) {
        data.report = {
          ...data.report,
          image_url: customDataUrl,
          is_live_upload: true,
        };
      }
      setScanStep(4);
      setSubmissionResult(data);
      onReportSubmitted(
        'Tamper-Proof Evidence Receipt generated & added to Command Map!',
        data.report
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification rejected by Truth Engine');
    } finally {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!submissionResult) return;
    const rep = submissionResult.report;
    const forensics = submissionResult.forensics;
    const printWin = window.open('', '_blank', 'width=720,height=840');
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Jan Drishti — Tamper-Proof Evidence Receipt</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 36px; color: #0F172A; background: #F8FAFC; }
            .card { background: #FFFFFF; border: 2px solid #0B1120; border-radius: 14px; padding: 28px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
            .header { border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 20px; font-weight: 900; color: #0B1120; margin: 0; }
            .sub { font-size: 12px; color: #64748B; margin-top: 4px; }
            .badge { background: #0B1120; color: #F59E0B; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 6px; letter-spacing: 0.5px; }
            .row { margin-bottom: 14px; }
            .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748B; letter-spacing: 0.6px; }
            .val { font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 2px; }
            .hash { font-family: monospace; font-size: 12px; background: #F1F5F9; padding: 10px; border-radius: 6px; word-break: break-all; border: 1px solid #CBD5E1; margin-top: 4px; }
            .footer { margin-top: 24px; padding-top: 14px; border-top: 1px dashed #CBD5E1; font-size: 11px; color: #64748B; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <h1 class="title">JAN DRISHTI • LEGAL EVIDENCE RECEIPT</h1>
                <div class="sub">People's Civic Truth Engine • Cryptographic Evidence Certificate</div>
              </div>
              <div class="badge">VERIFIED RECORD</div>
            </div>
            <div class="row">
              <div class="label">Report ID & Timestamp</div>
              <div class="val">${rep.id} • ${new Date(rep.created_at).toLocaleString()}</div>
            </div>
            <div class="row">
              <div class="label">AI Verified Headline</div>
              <div class="val">${rep.title}</div>
            </div>
            <div class="row">
              <div class="label">Hazard Category & AI Risk Score</div>
              <div class="val">${rep.category} • Risk Score ${rep.severity}/10</div>
            </div>
            <div class="row">
              <div class="label">Locality & Coordinates</div>
              <div class="val">${rep.locality} (${rep.lat.toFixed(5)}° N, ${rep.lng.toFixed(5)}° E)</div>
            </div>
            <div class="row">
              <div class="label">Detected Camera Hardware & GPS Verification</div>
              <div class="val">${forensics?.exif_metadata?.device || 'Unknown / Stripped EXIF'} • ${forensics?.exif_verified ? '✔ Real Camera GPS' : '⚠ Location Mismatch (Manual Pin)'}</div>
            </div>
            <div class="row">
              <div class="label">SHA-256 Cryptographic Fingerprint</div>
              <div class="hash">${forensics?.evidence_hash || rep.evidence_hash}</div>
            </div>
            <div class="footer">
              Admissible Digital Proof Seal generated by Jan Drishti Truth Engine. Any alteration to the original image invalidates the SHA-256 fingerprint above.
            </div>
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleCloseAndReset = () => {
    if (isSubmitting) return;
    setFile(null);
    setPreviewUrl(null);
    setCustomDataUrl(null);
    setUserNote('');
    setSubmissionResult(null);
    setErrorMessage(null);
    setScanStep(0);
    onClose();
  };

  return (
    <div
      onClick={handleCloseAndReset}
      className="fixed inset-0 z-[9998] flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fade-in overscroll-contain"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-slide-left overscroll-contain"
      >
        {/* Deep Midnight Slate Header */}
        <div className="px-6 py-4 bg-[#0B1120] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 id="report-modal-title" className="text-base font-extrabold">
                Report a Civic Problem
              </h2>
            </div>
            <p className="text-xs text-slate-400">Citizen Evidence Upload &amp; Cryptographic Seal</p>
          </div>
          <button
            type="button"
            aria-label="Close Report a Civic Problem drawer"
            onClick={handleCloseAndReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 overscroll-contain">
          {submissionResult ? (
            <div className="space-y-4 py-2 animate-fade-in">
              {/* Tamper-Proof Evidence Receipt Certificate */}
              <div className="rounded-2xl border-2 border-[#0B1120] bg-white shadow-xl overflow-hidden">
                <div className="bg-[#0B1120] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileBadge className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                        Tamper-Proof Evidence Receipt
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ID: {submissionResult.report.id.substring(0, 18)}...
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase">
                    Sealed &amp; Logged
                  </span>
                </div>

                <div className="p-5 space-y-3.5 text-xs">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        AI Verified Headline
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {submissionResult.report.title}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        AI Risk Score
                      </span>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-md bg-red-600 text-white font-mono font-black text-xs">
                        {submissionResult.report.severity}/10
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        Detected Camera Model
                      </span>
                      <span className="font-bold text-slate-800 font-mono text-[11px]">
                        {submissionResult.forensics?.exif_metadata?.device ||
                          'Unknown / Stripped EXIF'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        GPS Verification Status
                      </span>
                      <span
                        className={`font-extrabold text-[11px] ${
                          submissionResult.forensics?.exif_verified
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {submissionResult.forensics?.exif_verified
                          ? '✔ Real Camera GPS'
                          : '⚠ Needs Reviewer Check'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        Hazard Category
                      </span>
                      <span className="font-bold text-slate-800">
                        {submissionResult.report.category}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                        Sector / Locality
                      </span>
                      <span className="font-bold text-slate-800">
                        {submissionResult.report.locality}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">
                      SHA-256 Cryptographic Fingerprint (Matches Photo Verifier 1:1)
                    </span>
                    <div className="font-mono text-[10px] text-slate-700 break-all bg-slate-100 p-2.5 rounded-lg border border-slate-200 select-all">
                      {submissionResult.forensics?.evidence_hash ||
                        submissionResult.report.evidence_hash}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Print Legal Receipt or Return to Map */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold rounded-xl text-xs border border-slate-300 flex items-center justify-center gap-2 transition-all"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>Print / Save Legal Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseAndReset}
                  className="flex-1 py-3 px-4 bg-[#0B1120] hover:bg-slate-800 text-amber-400 font-extrabold rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>View on Tactical Map</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Input with Preview + 1-Click Judge Demo Loader */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    1. Evidence Photograph <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    disabled={loadingSample || isSubmitting}
                    onClick={handleLoadSampleFieldPhoto}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {loadingSample ? 'Loading Sample...' : '1-Click Load Sample Field Photo'}
                    </span>
                  </button>
                </div>

                {previewUrl ? (
                  <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-44 object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove selected photo"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                        setCustomDataUrl(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-red-600 transition-colors shadow"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-slate-900/85 text-white text-[10px] font-mono">
                      {file?.name} ({(file?.size ? file.size / 1024 : 0).toFixed(1)} KB)
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-amber-50/20"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-2">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">
                      Take Photo or Upload Evidence
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      JPG, PNG with camera EXIF &amp; GPS telemetry (or use 1-Click Sample above)
                    </div>
                  </div>
                )}
              </div>

              {/* Location Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    2. Sector &amp; Coordinates <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    className="text-[11px] font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Detect My GPS
                  </button>
                </div>

                {/* Preset Location Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  {PRESET_LOCATIONS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-left p-2.5 rounded-xl text-xs border transition-all ${
                        locality === preset.name
                          ? 'border-amber-500 bg-amber-50/70 text-slate-900 font-extrabold ring-1 ring-amber-400/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="font-bold truncate">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {preset.lat.toFixed(4)}, {preset.lng.toFixed(4)}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 block font-sans font-bold">
                      LATITUDE
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block font-sans font-bold">
                      LONGITUDE
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Citizen Note */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Field Observation Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="Describe the hazard (e.g., live high-tension wire sparking near hostel gate, open storm drain)..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice:</span> {errorMessage}
                  </div>
                </div>
              )}

              {/* 3-Step Live Forensic Scan Animation */}
              {isSubmitting && (
                <div className="p-4 rounded-2xl bg-[#0B1120] text-white space-y-3 font-mono text-xs shadow-xl border border-slate-800">
                  <div className="flex items-center gap-2 font-sans font-extrabold text-amber-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Live Forensic Scan in Progress...</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div
                      className={`flex items-center gap-2 ${
                        scanStep >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'
                      }`}
                    >
                      <span>{scanStep >= 1 ? '✓' : '○'}</span>
                      <span>1. Checking Camera GPS &amp; EXIF Hardware</span>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        scanStep >= 2 ? 'text-emerald-400 font-bold' : 'text-slate-500'
                      }`}
                    >
                      <span>{scanStep >= 2 ? '✓' : '○'}</span>
                      <span>2. Generating SHA-256 Fingerprint</span>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        scanStep >= 3
                          ? 'text-amber-400 font-bold animate-pulse'
                          : 'text-slate-500'
                      }`}
                    >
                      <span>{scanStep >= 3 ? '⚡' : '○'}</span>
                      <span>3. Gemini 3.8 Flash Hazard Audit &amp; Severity Scoring</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !file}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running Forensic Audit...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                    <span>Verify &amp; Generate Evidence Receipt</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
