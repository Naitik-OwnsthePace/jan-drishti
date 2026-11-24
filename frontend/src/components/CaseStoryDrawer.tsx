import React, { useState } from 'react';
import type { Report, UserRole, DisputeRecord } from '../types';
import { downloadRtiNoticePdf } from '../utils/pdfExport';
import {
  getAlignedCivicPhoto,
  getResolutionDurationLabel,
  getEvidenceSourceLabel,
} from '../utils/civicPhotos';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  Scale,
  Upload,
  SlidersHorizontal,
  Hash,
  Layers,
  Wrench,
  FileText,
  Newspaper,
  XCircle,
  Sparkles,
  AlertOctagon,
  GitMerge,
  Download,
  Lock,
  MessageSquare,
} from 'lucide-react';

interface CaseStoryDrawerProps {
  report: Report | null;
  isDismissed?: boolean;
  disputeRecord?: DisputeRecord;
  workOrderId?: string;
  isPressEscalated?: boolean;
  clusterCount: number;
  isAuthenticated: boolean;
  currentRole: UserRole;
  trustScores: Record<UserRole, number>;
  openDisputesCount: number;
  onClose: () => void;
  onOpenLoginModal: () => void;
  onVerify: (id: string, action: 'ESCALATE' | 'REJECT' | 'DISPUTE' | 'MERGE_HOTSPOT') => void;
  onOpenPressKit: (clusterId: string) => void;
  onOpenResolutionModal: (report: Report) => void;
  onOpenDisputeModal: (report: Report) => void;
  onSubmitAuthorityReply: (reportId: string, replyText: string) => void;
  onAdjudicateDispute: (reportId: string, verdict: 'UPHOLD' | 'REJECT') => void;
  onOpenBeforeAfterModal: (report: Report) => void;
  onNavigateToEPaper: (reportId: string) => void;
}

function getPublicSafetyImpact(report: Report): string {
  const cat = report.category.toLowerCase();
  if (cat.includes('electric')) {
    return 'High-voltage exposure adjacent to pedestrian movement creates immediate electrocution and fire hazards, particularly during evening commutes or rainfall.';
  }
  if (cat.includes('road') || cat.includes('pothole')) {
    return 'Deep arterial road cavity poses severe two-wheeler skid and vehicular axle damage risk at a high-velocity traffic turn.';
  }
  if (cat.includes('dump') || cat.includes('sanitation')) {
    return 'Accumulated municipal waste and construction debris obstruct primary storm drainage, risking vector-borne disease and flash waterlogging.';
  }
  if (cat.includes('water')) {
    return 'Stagnant waterlogging erodes road sub-base and blocks emergency and pedestrian access across the sector.';
  }
  return 'Corroborated public infrastructure hazard impacting daily commuter safety and municipal service standards.';
}

function getActionMandate(report: Report): {
  department: string;
  mandate: string;
  charterSlaClock: string;
  rtiStatutoryWindow: string;
} {
  const cat = report.category.toLowerCase();
  const titleLower = report.title.toLowerCase();
  const isLifeLiberty = report.severity >= 8;

  const rtiStatutoryWindow = isLifeLiberty
    ? '48-Hour Emergency Life & Physical Safety Proviso — Section 7(1), RTI Act 2005 (Risk ≥ 8/10)'
    : '30-Day Standard Statutory Response Window — Section 7(1), RTI Act 2005 (Risk < 8/10)';

  if (cat.includes('electric')) {
    const isStreetlightOnly =
      titleLower.includes('streetlight') && !titleLower.includes('11kv') && report.severity < 8;
    return {
      department: 'GNIDA Electrical & Streetlighting Division / NPCL Safety Wing',
      mandate:
        'Immediate de-energization of exposed busbars, installation of weatherproof IP65 lockable feeder enclosure, and earthing continuity test.',
      charterSlaClock: isStreetlightOnly
        ? '7 Days (168 Hours) — GNIDA Citizen Charter Streetlight & Routine Drain SLA'
        : '24 Hours — GNIDA Citizen Charter Emergency Electrical & Water Supply SLA',
      rtiStatutoryWindow,
    };
  }
  if (cat.includes('road')) {
    return {
      department: 'GNIDA Civil Engineering & Arterial Roads Circle',
      mandate:
        'Deploy reflective hazard barricades immediately, excavate loose sub-base, install cast-iron manhole cover, and resurface crater with hot-mix concrete.',
      charterSlaClock: '72 Hours (3 Days) — GNIDA Citizen Charter Open Manhole & Arterial Crater SLA',
      rtiStatutoryWindow,
    };
  }
  if (cat.includes('dump') || cat.includes('sanitation') || cat.includes('water')) {
    const isRoutineDrain = report.severity <= 6 && !titleLower.includes('overflow');
    return {
      department: 'GNIDA Public Health, Drainage & Solid Waste Management Cell',
      mandate:
        'Dispatch JCB loader and suction pumps to clear malba/bio-waste, desilt blocked storm drain channel, and apply lime sanitization.',
      charterSlaClock: isRoutineDrain
        ? '7 Days (168 Hours) — GNIDA Citizen Charter Routine Drain & Street Maintenance SLA'
        : '72 Hours (3 Days) — GNIDA Citizen Charter Waterlogging, Sewer & Malba Clearance SLA',
      rtiStatutoryWindow,
    };
  }
  return {
    department: 'GNIDA Zonal Maintenance & Enforcement Division',
    mandate:
      'Conduct on-site engineering inspection, clear public right-of-way hazard, and upload geo-tagged After-photo remediation proof.',
    charterSlaClock: '72 Hours (3 Days) — GNIDA Citizen Charter Civic Infrastructure SLA',
    rtiStatutoryWindow,
  };
}

export const CaseStoryDrawer: React.FC<CaseStoryDrawerProps> = ({
  report,
  isDismissed = false,
  disputeRecord,
  workOrderId,
  isPressEscalated = false,
  clusterCount,
  isAuthenticated,
  currentRole,
  trustScores,
  openDisputesCount,
  onClose,
  onOpenLoginModal,
  onVerify,
  onOpenPressKit,
  onOpenResolutionModal,
  onOpenDisputeModal,
  onSubmitAuthorityReply,
  onAdjudicateDispute,
  onOpenBeforeAfterModal,
  onNavigateToEPaper,
}) => {
  const [replyText, setReplyText] = useState<string>(disputeRecord?.authorityReply || '');

  if (!report) return null;

  const impactText = getPublicSafetyImpact(report);
  const mandateInfo = getActionMandate(report);
  const alignedScene = getAlignedCivicPhoto(report);
  const resolutionDuration = getResolutionDurationLabel(report);
  const sourceLabel = getEvidenceSourceLabel(report);

  const isUnderDisputeReview = disputeRecord?.status === 'UNDER_REVIEW';
  const isDisputeUpheld = disputeRecord?.status === 'UPHELD';

  let bannerBg = 'bg-amber-500 text-slate-950';
  let bannerTitle = 'ACTIVE ESCALATION • ACTION NEEDED BY AUTHORITY';
  let bannerNarrative =
    'Camera EXIF & SHA-256 digital proof verified. Waiting for GNIDA Zone-3 field crew to repair hazard and upload After-photo proof.';

  if (isDismissed) {
    bannerBg = 'bg-slate-800 text-red-300 border-b border-red-500/40';
    bannerTitle = 'CASE DISMISSED • FLAGGED FOR GPS / EXIF TAMPERING';
    bannerNarrative =
      'Narrative Reversed: Truth Engine Auditor dismissed this submission after forensic check flagged location mismatch or unverifiable evidence.';
  } else if (isUnderDisputeReview) {
    bannerBg = 'bg-purple-700 text-white';
    bannerTitle = 'UNDER DISPUTE REVIEW • AWAITING REVIEWER ADJUDICATION';
    bannerNarrative = `Accredited Journalist (#JD-204) staked Trust Score with counter-photo evidence: "${disputeRecord?.reason}". Authority Right of Reply unlocked; awaiting Reviewer ruling.`;
  } else if (isDisputeUpheld) {
    bannerBg = 'bg-rose-700 text-white';
    bannerTitle = 'PRESS DISPUTE UPHELD BY REVIEWER • TICKET RE-OPENED';
    bannerNarrative = `Reviewer upheld Journalist #JD-204's counter-evidence (+15 Press Trust, -12 Authority Trust). Status reversed to Overdue for mandatory re-repair.`;
  } else if (report.status === 'RESOLVED') {
    bannerBg = 'bg-emerald-600 text-white';
    bannerTitle = `CASE REVERSED & RESOLVED • BEFORE / AFTER PROOF VERIFIED (${resolutionDuration.toUpperCase()})`;
    bannerNarrative = `Narrative Reversed: GNIDA Zone-3 crew completed on-site remediation in ${resolutionDuration} under Work-Order ${
      workOrderId || 'GNIDA/Z3/2026/WO-419'
    } and uploaded geo-verified After-photo proof.`;
  } else if (report.status === 'SLA_BREACHED') {
    bannerBg = 'bg-red-600 text-white';
    bannerTitle = 'CRITICAL SLA BREACH • IGNORED PAST DEADLINE';
    bannerNarrative =
      'Municipal SLA deadline expired without authority remediation. Case unlocked for Journalist Broadsheet e-Paper & Statutory RTI Act 2005 Notice.';
  } else if (report.status === 'UNVERIFIED') {
    bannerBg = 'bg-slate-700 text-white';
    bannerTitle = 'NEEDS CHECK • AWAITING REVIEWER FORENSIC AUDIT';
    bannerNarrative =
      'Citizen report captured and SHA-256 sealed. Awaiting Reviewer verification of camera EXIF metadata and GPS offset.';
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-slide-left"
      >
        {/* Top Midnight Header */}
        <div className="px-6 py-4 bg-[#0B1120] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold">
                  Full Case Story &amp; Chain of Custody
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold uppercase">
                  Case #{report.id.substring(0, 8)}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                  {sourceLabel}
                </span>
                {isPressEscalated && (
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-600 text-white uppercase">
                    PRESS ESCALATED • MEDIA WATCH
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Live 4-Role Accountability Narrative • {report.locality}
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

        {/* Dynamic Reversal Narrative Banner */}
        <div className={`px-6 py-3.5 shrink-0 transition-colors duration-300 ${bannerBg}`}>
          <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>{bannerTitle}</span>
          </div>
          <p className="text-xs font-medium mt-1 opacity-95 leading-relaxed">
            {bannerNarrative}
          </p>
        </div>

        {/* Scrollable Case Story Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
          {/* Hero Evidence Split Card with Visible EXIF Telemetry Stamp */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12">
              <div className="sm:col-span-5 relative bg-slate-900 min-h-[190px]">
                <img
                  src={report.image_url || alignedScene.beforeUrl}
                  alt={report.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = alignedScene.beforeUrl;
                  }}
                />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-950/85 text-amber-400 font-mono text-xs font-extrabold">
                  BEFORE (CITIZEN PROOF)
                </span>
                {/* Visible EXIF Telemetry Stamp */}
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-white px-2.5 py-1.5 font-mono text-xs border-t border-slate-800">
                  <div className="text-amber-300 font-bold truncate">
                    📷 {report.exif_metadata?.device || 'Citizen Camera'}
                  </div>
                  <div className="text-slate-300 truncate">
                    📍 {report.lat.toFixed(4)}°N, {report.lng.toFixed(4)}°E
                  </div>
                </div>
              </div>
              <div className="sm:col-span-7 p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-extrabold text-xs border border-slate-200">
                      {report.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-black ${
                        report.severity >= 8
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      Risk Score: {report.severity}/10
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-950 leading-snug">
                    {report.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {report.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span className="flex items-center gap-1 text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {report.locality}
                  </span>
                  <span className="flex items-center gap-1 text-rose-700 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    {clusterCount} Citizen(s) Corroborated
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION A: What Is Happening & Risk Explanation */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Section A — What Is Happening &amp; Risk Explanation</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-500">
                AI Forensic Assessment
              </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              {impactText}
            </p>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">Public Safety Threat Level</span>
                <span className="font-mono text-red-600">{report.severity} / 10</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    report.severity >= 8 ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, report.severity * 10)}%` }}
                />
              </div>
            </div>
          </div>

          {/* SECTION B: Real GNIDA Citizen Charter SLA Clock & Statutory RTI Status */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>Section B — GNIDA Citizen Charter SLA Clock &amp; Statutory RTI Status</span>
              </h4>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold">
                GNIDA Helpline: 8800203912
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                <span className="text-xs font-black uppercase text-amber-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  GNIDA Citizen Charter SLA Clock
                </span>
                <p className="font-extrabold text-slate-900 leading-snug">
                  {mandateInfo.charterSlaClock}
                </p>
                <p className="text-xs text-slate-600">
                  Charter Reference: 24h Water/Critical Electrical • 72h Manhole/Waterlogging/Malba • 7d Streetlight/Drain
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border space-y-1 ${
                  report.severity >= 8
                    ? 'bg-red-50/70 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span
                  className={`text-xs font-black uppercase flex items-center gap-1 ${
                    report.severity >= 8 ? 'text-red-800' : 'text-slate-700'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  Statutory RTI Act 2005 Window
                </span>
                <p className="font-extrabold text-slate-900 leading-snug">
                  {mandateInfo.rtiStatutoryWindow}
                </p>
                <p className="text-xs text-slate-600">
                  PIO: GNIDA Knowledge Park-IV • Section 6(1) &amp; Section 7(1)
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div>
                <span className="text-xs font-extrabold uppercase text-slate-400 block">
                  Responsible Authority Wing:
                </span>
                <span className="font-bold text-sm text-slate-900">{mandateInfo.department}</span>
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase text-slate-400 block">
                  Required Field Remediation:
                </span>
                <p className="text-sm text-slate-700 font-medium leading-relaxed mt-0.5">
                  {mandateInfo.mandate}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION C: Live 4-Role Chain-of-Custody Timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Section C — Live 4-Role Chain-of-Custody &amp; Trust Timeline</span>
              </h4>
              {!isAuthenticated ? (
                <button
                  onClick={onOpenLoginModal}
                  className="text-xs font-extrabold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-300 flex items-center gap-1"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>🔒 Sign in via Demo Login to act</span>
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                  RBAC Active: {currentRole.toUpperCase()}
                </span>
              )}
            </div>

            <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Node 1: Citizen Capture */}
              <div className="relative">
                <span className="absolute -left-[22px] top-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow">
                  1
                </span>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      1. Citizen Capture (Verified Citizen #C-042 • Trust {trustScores.citizen}/100)
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {sourceLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Captured via <strong>{report.exif_metadata?.device || 'Citizen Smartphone'}</strong> at{' '}
                    {report.lat.toFixed(4)}°N, {report.lng.toFixed(4)}°E (
                    {report.exif_metadata?.captured_at || new Date(report.created_at).toLocaleString()}
                    ).
                  </p>
                  <div className="text-xs font-mono text-slate-500 flex items-center gap-1 truncate">
                    <Hash className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{report.evidence_hash}</span>
                  </div>
                </div>
              </div>

              {/* Node 2: Reviewer Audit */}
              <div className="relative">
                <span
                  className={`absolute -left-[22px] top-0.5 w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-black shadow ${
                    isDismissed
                      ? 'bg-red-600'
                      : isUnderDisputeReview
                      ? 'bg-purple-600 animate-pulse'
                      : report.status === 'UNVERIFIED'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                >
                  2
                </span>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      2. Reviewer Audit (Truth Engine Auditor • Trust {trustScores.verifier}/100)
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                        isDismissed
                          ? 'bg-red-100 text-red-700'
                          : isUnderDisputeReview
                          ? 'bg-purple-100 text-purple-900'
                          : report.status === 'UNVERIFIED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isDismissed
                        ? 'DISMISSED AS FAKE'
                        : isUnderDisputeReview
                        ? 'ARBITRATING PRESS DISPUTE'
                        : report.status === 'UNVERIFIED'
                        ? 'AWAITING AUDIT'
                        : 'VERIFIED & ESCALATED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {report.exif_verified
                      ? `✔ Real Camera GPS matches reported coordinates (±${
                          report.exif_metadata?.distance_offset_m || 9
                        }m offset).`
                      : '⚠ EXIF metadata stripped or GPS offset >250m — requires human Auditor ruling.'}
                  </p>

                  {isAuthenticated && currentRole === 'verifier' ? (
                    report.status === 'UNVERIFIED' && !isDismissed ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() => onVerify(report.id, 'ESCALATE')}
                          className="px-3 py-1.5 rounded-lg bg-[#0B1120] hover:bg-slate-800 text-amber-400 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Escalate</span>
                        </button>
                        <button
                          onClick={() => onVerify(report.id, 'MERGE_HOTSPOT')}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          <span>Merge into Hotspot</span>
                        </button>
                        <button
                          onClick={() => onVerify(report.id, 'REJECT')}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Dismiss Fake</span>
                        </button>
                      </div>
                    ) : isUnderDisputeReview ? (
                      <div className="pt-1 flex flex-wrap gap-2">
                        <button
                          onClick={() => onAdjudicateDispute(report.id, 'UPHOLD')}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black"
                        >
                          ✔ Uphold Press Dispute (+15 Press / -12 Auth)
                        </button>
                        <button
                          onClick={() => onAdjudicateDispute(report.id, 'REJECT')}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold"
                        >
                          ✖ Reject Dispute (-10 Press)
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>✔ Already Audited &amp; Verified by Truth Engine</span>
                      </div>
                    )
                  ) : null}
                </div>
              </div>

              {/* Node 3: Journalist Media & RTI Escalation */}
              <div className="relative">
                <span
                  className={`absolute -left-[22px] top-0.5 w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-black shadow ${
                    report.status === 'SLA_BREACHED' || isUnderDisputeReview || isDisputeUpheld || clusterCount >= 2
                      ? 'bg-red-600 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                >
                  3
                </span>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-amber-600" />
                      3. Journalist Intervention (Accredited Press #JD-204 • Trust {trustScores.journalist}/100)
                    </span>
                    <span className="text-xs font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      {isUnderDisputeReview
                        ? 'UNDER DISPUTE REVIEW'
                        : isDisputeUpheld
                        ? 'DISPUTE UPHELD'
                        : isPressEscalated
                        ? 'PRESS ESCALATED'
                        : 'PRESS DESK'}
                    </span>
                  </div>

                  {disputeRecord && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-1.5">
                      <div className="font-black uppercase flex items-center justify-between text-rose-700">
                        <span>Press Counter-Evidence Logged (#JD-204)</span>
                        <span className="font-mono">{disputeRecord.status}</span>
                      </div>
                      <p className="font-medium leading-snug">&ldquo;{disputeRecord.reason}&rdquo;</p>
                      <div className="flex items-center gap-2 pt-1">
                        <img
                          src={disputeRecord.counterPhotoUrl}
                          alt="Counter proof"
                          className="w-16 h-12 object-cover rounded border border-rose-400"
                        />
                        <span className="font-mono text-xs text-rose-800">
                          File: {disputeRecord.counterPhotoName}
                        </span>
                      </div>
                    </div>
                  )}

                  {isAuthenticated && currentRole === 'journalist' ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToEPaper(report.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Newspaper className="w-3.5 h-3.5" />
                        <span>Promote to Front Page &amp; RTI</span>
                      </button>
                      <button
                        onClick={() => downloadRtiNoticePdf([report], report.cluster_id || report.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download RTI Notice PDF</span>
                      </button>
                      <button
                        onClick={() => onOpenPressKit(report.cluster_id || report.id)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>Open 3-Tab Dossier</span>
                      </button>
                      {report.status === 'RESOLVED' && !isUnderDisputeReview && !isDisputeUpheld && (
                        <button
                          onClick={() => onOpenDisputeModal(report)}
                          disabled={trustScores.journalist < 65 || openDisputesCount >= 3}
                          className="w-full mt-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>
                            Dispute &amp; Re-Open Fix (Stake -10 / +15 Trust • Quota {openDisputesCount}/3)
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Sign in as <strong>Journalist (#JD-204)</strong> or <strong>Demo Admin</strong> to promote to Front Page, generate RTI PDF, or stake Trust on a dispute.
                    </p>
                  )}
                </div>
              </div>

              {/* Node 4: Authority Resolution & Right of Reply */}
              <div className="relative">
                <span
                  className={`absolute -left-[22px] top-0.5 w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-black shadow ${
                    report.status === 'RESOLVED' && !isDisputeUpheld ? 'bg-emerald-600' : 'bg-slate-400'
                  }`}
                >
                  4
                </span>
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    report.status === 'RESOLVED' && !isDisputeUpheld
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      4. Authority Resolution (GNIDA Official Zone-3 • Trust {trustScores.authority}/100)
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                        report.status === 'RESOLVED' && !isDisputeUpheld
                          ? 'bg-emerald-600 text-white'
                          : isUnderDisputeReview || isDisputeUpheld
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {report.status === 'RESOLVED' && !isDisputeUpheld
                        ? `FIXED IN ${resolutionDuration.toUpperCase()} • ${
                            workOrderId || 'GNIDA/Z3/2026/WO-419'
                          }`
                        : isUnderDisputeReview
                        ? 'RIGHT OF REPLY UNLOCKED'
                        : isDisputeUpheld
                        ? 'DISPUTE UPHELD • RE-REPAIR REQUIRED'
                        : 'PENDING PROOF'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {report.status === 'RESOLVED' && !isDisputeUpheld
                      ? `GNIDA Zone-3 crew uploaded geo-verified After-photo remediation proof in ${resolutionDuration} under Work-Order ${
                          workOrderId || 'GNIDA/Z3/2026/WO-419'
                        }.`
                      : 'Officials cannot delete complaints or close tickets without uploading an on-site After-photo showing completed repair.'}
                  </p>

                  {disputeRecord?.authorityReply && (
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-300 text-xs text-slate-800">
                      <strong className="text-emerald-800 block uppercase">
                        Official Authority Right of Reply:
                      </strong>
                      <span>&ldquo;{disputeRecord.authorityReply}&rdquo;</span>
                    </div>
                  )}

                  {isAuthenticated &&
                    currentRole === 'authority' &&
                    isUnderDisputeReview && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Post Official Right of Reply for Reviewer Arbitration:</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="State contractor work-order log or site inspection response..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (replyText.trim()) {
                                onSubmitAuthorityReply(report.id, replyText.trim());
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                          >
                            Post Reply
                          </button>
                        </div>
                      </div>
                    )}

                  <div className="pt-1 flex flex-wrap gap-2">
                    {report.status === 'RESOLVED' && !isDisputeUpheld && (
                      <button
                        onClick={() => onOpenBeforeAfterModal(report)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Compare Before &amp; After Split Slider ({resolutionDuration})</span>
                      </button>
                    )}

                    {isAuthenticated &&
                      currentRole === 'authority' &&
                      (report.status !== 'RESOLVED' || isDisputeUpheld) &&
                      (report.status === 'UNVERIFIED' ? (
                        <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-600 text-xs font-bold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Locked: Awaiting Reviewer EXIF/GPS Verification</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => onOpenResolutionModal(report)}
                          className="px-3.5 py-2 rounded-lg bg-[#0B1120] hover:bg-slate-800 text-emerald-400 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload &apos;After&apos; Photo (Required to Close Ticket)</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
