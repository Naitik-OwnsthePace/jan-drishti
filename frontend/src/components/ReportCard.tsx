import React, { useState, useEffect } from 'react';
import type { Report, UserRole, DisputeRecord } from '../types';
import {
  getAlignedCivicPhoto,
  getResolutionDurationLabel,
  getEvidenceSourceLabel,
} from '../utils/civicPhotos';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Layers,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Navigation,
  Hash,
  Eye,
  SlidersHorizontal,
  ThumbsUp,
  BookOpen,
  XCircle,
  AlertOctagon,
  GitMerge,
  Camera,
  Newspaper,
  Lock,
  Scale,
  MessageSquare,
} from 'lucide-react';

interface ReportCardProps {
  report: Report;
  pinNumber?: number;
  isDismissed?: boolean;
  disputeRecord?: DisputeRecord;
  workOrderId?: string;
  isPressEscalated?: boolean;
  clusterCount: number;
  isSelected: boolean;
  isAuthenticated: boolean;
  currentRole: UserRole;
  trustScores: Record<UserRole, number>;
  openDisputesCount: number;
  onSelect: () => void;
  onHover?: (id: string | null) => void;
  onOpenLoginModal: () => void;
  onOpenCaseStory: (report: Report) => void;
  onVerify: (id: string, action: 'ESCALATE' | 'REJECT' | 'DISPUTE' | 'MERGE_HOTSPOT') => void;
  onOpenDisputeModal: (report: Report) => void;
  onSubmitAuthorityReply: (reportId: string, replyText: string) => void;
  onAdjudicateDispute: (reportId: string, verdict: 'UPHOLD' | 'REJECT') => void;
  onOpenPressKit: (clusterId: string) => void;
  onPromoteToEPaper: (report: Report) => void;
  onOpenResolutionModal: (report: Report) => void;
  onOpenBeforeAfterModal: (report: Report) => void;
  onOpenLightbox: (report: Report) => void;
  onConfirmOnSite?: (report: Report, note?: string) => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  pinNumber,
  isDismissed = false,
  disputeRecord,
  workOrderId,
  isPressEscalated = false,
  clusterCount,
  isSelected,
  isAuthenticated,
  currentRole,
  trustScores,
  openDisputesCount,
  onSelect,
  onHover,
  onOpenLoginModal,
  onOpenCaseStory,
  onVerify,
  onOpenDisputeModal,
  onSubmitAuthorityReply,
  onAdjudicateDispute,
  onOpenPressKit,
  onPromoteToEPaper,
  onOpenResolutionModal,
  onOpenBeforeAfterModal,
  onOpenLightbox,
  onConfirmOnSite,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [slaTimeText, setSlaTimeText] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);
  const [confirmedOnSite, setConfirmedOnSite] = useState<boolean>(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState<boolean>(false);
  const [confirmNote, setConfirmNote] = useState<string>('Verified hazard still active on-site via GPS lock');
  const [extraConfirmCount, setExtraConfirmCount] = useState<number>(0);
  const [authorityReplyInput, setAuthorityReplyInput] = useState<string>(
    disputeRecord?.authorityReply || ''
  );

  const isUnderDisputeReview = disputeRecord?.status === 'UNDER_REVIEW';
  const isDisputeUpheld = disputeRecord?.status === 'UPHELD';
  const resolutionDuration = getResolutionDurationLabel(report);
  const sourceLabel = getEvidenceSourceLabel(report);

  useEffect(() => {
    if (isDismissed) {
      setSlaTimeText('Dismissed by Reviewer');
      setIsOverdue(false);
      return;
    }

    if (isUnderDisputeReview) {
      setSlaTimeText('Under Dispute Review • Awaiting Reviewer');
      setIsOverdue(true);
      return;
    }

    if (isDisputeUpheld) {
      setSlaTimeText('Press Dispute Upheld • Ticket Re-Opened');
      setIsOverdue(true);
      return;
    }

    if (report.status === 'RESOLVED') {
      setSlaTimeText(
        workOrderId
          ? `Fixed in ${resolutionDuration} (${workOrderId})`
          : `Fixed & Verified in ${resolutionDuration}`
      );
      setIsOverdue(false);
      return;
    }

    if (!report.sla_deadline) {
      if (report.status === 'SLA_BREACHED') {
        setSlaTimeText('Ignored 19h past deadline');
        setIsOverdue(true);
      } else if (report.status === 'ESCALATED') {
        setSlaTimeText('28h left to fix');
        setIsOverdue(false);
      } else {
        setSlaTimeText('Awaiting Reviewer Audit');
        setIsOverdue(false);
      }
      return;
    }

    const updateSla = () => {
      const now = new Date().getTime();
      const deadline = new Date(report.sla_deadline!).getTime();
      const diff = deadline - now;

      if (diff <= 0 || report.status === 'SLA_BREACHED') {
        setIsOverdue(true);
        const overdueHours = Math.max(4, Math.min(36, Math.floor(Math.abs(diff) / (1000 * 60 * 60))));
        setSlaTimeText(`Ignored ${overdueHours}h past deadline`);
      } else {
        setIsOverdue(false);
        const hoursLeft = Math.max(4, Math.floor(diff / (1000 * 60 * 60)));
        setSlaTimeText(`${hoursLeft}h left to fix`);
      }
    };

    updateSla();
    const interval = setInterval(updateSla, 60000);
    return () => clearInterval(interval);
  }, [
    report.sla_deadline,
    report.status,
    isDismissed,
    isUnderDisputeReview,
    isDisputeUpheld,
    workOrderId,
    resolutionDuration,
  ]);

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(report.evidence_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSealOnSiteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmedOnSite(true);
    setShowConfirmPrompt(false);
    setExtraConfirmCount((c) => c + 1);
    if (onConfirmOnSite) onConfirmOnSite(report, confirmNote);
  };

  const totalConfirmedCitizens = clusterCount + extraConfirmCount;

  const getLeftBorderClass = () => {
    if (isDismissed) return 'border-l-4 border-l-slate-400 opacity-75';
    if (isUnderDisputeReview) return 'border-l-4 border-l-purple-600';
    if (isDisputeUpheld) return 'border-l-4 border-l-rose-600';
    switch (report.status) {
      case 'SLA_BREACHED':
        return 'border-l-4 border-l-[#EF4444]';
      case 'ESCALATED':
        return 'border-l-4 border-l-[#F59E0B]';
      case 'RESOLVED':
        return 'border-l-4 border-l-[#10B981]';
      default:
        return 'border-l-4 border-l-[#94A3B8]';
    }
  };

  const getStatusBadge = () => {
    if (isDismissed) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-200 text-slate-700 border border-slate-400">
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          Case Dismissed (Flagged Fake)
        </span>
      );
    }
    if (isUnderDisputeReview) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-400 animate-pulse">
          <Scale className="w-3.5 h-3.5 text-purple-700" />
          Under Dispute Review
        </span>
      );
    }
    if (isDisputeUpheld) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-400 animate-pulse">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
          Overdue (Dispute Upheld)
        </span>
      );
    }
    switch (report.status) {
      case 'SLA_BREACHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Overdue (Ignored)
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            Action Needed
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Fixed &amp; Verified ({resolutionDuration})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            Needs Check
          </span>
        );
    }
  };

  const fallbackAlignedUrl = getAlignedCivicPhoto(report).beforeUrl;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHover && onHover(report.id)}
      onMouseLeave={() => onHover && onHover(null)}
      className={`group cursor-pointer rounded-2xl bg-white border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${getLeftBorderClass()} ${
        isSelected
          ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/10'
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      <div className="p-5">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {pinNumber !== undefined && (
              <span className="w-6 h-6 rounded-full bg-[#0B1120] text-amber-400 font-mono text-xs font-black flex items-center justify-center shadow-xs">
                {pinNumber}
              </span>
            )}
            {getStatusBadge()}
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {report.category}
            </span>
            {/* Honest Data Provenance Badge */}
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                sourceLabel.startsWith('Live')
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              {sourceLabel}
            </span>
            {totalConfirmedCitizens >= 2 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-300 shadow-xs">
                <Layers className="w-3.5 h-3.5 text-rose-600" />
                {totalConfirmedCitizens} Citizens Reported Here
              </span>
            )}
            {isPressEscalated && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#0B1120] text-amber-400 border border-amber-500/40">
                <Newspaper className="w-3.5 h-3.5" />
                PRESS ESCALATED • MEDIA WATCH
              </span>
            )}
          </div>

          {/* Risk / Severity Score */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            title={`AI Public Safety Risk Score: ${report.severity}/10 (${report.category})`}
          >
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">
              Risk
            </span>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-md font-mono ${
                report.severity >= 8
                  ? 'bg-red-600 text-white'
                  : report.severity >= 6
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {report.severity}/10
            </span>
          </div>
        </div>

        {/* Content Row: Photo with Visible EXIF Stamp Overlay + Headline & Summary */}
        <div className="flex gap-4 mb-3.5">
          {/* Thumbnail with EXIF Telemetry Stamp Overlay */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenLightbox(report);
            }}
            className="w-28 h-28 rounded-xl bg-slate-900 border border-slate-300 shrink-0 overflow-hidden relative group/thumb shadow-xs"
            title="Click to open full-size Evidence Lightbox & Camera Telemetry"
          >
            <img
              src={report.image_url}
              alt={report.title}
              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackAlignedUrl;
              }}
            />
            <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 text-white px-1.5 py-1 font-mono text-xs leading-tight truncate border-t border-slate-700/80">
              <div className="text-amber-300 font-bold truncate">
                {report.exif_metadata?.device?.split(' ')[0] || 'EXIF'} • {report.lat.toFixed(3)}°N
              </div>
            </div>
            <div className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="w-5 h-5 drop-shadow" />
            </div>
            {report.after_image_url && !isDisputeUpheld && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-600 text-xs font-black text-white shadow">
                + After
              </span>
            )}
          </div>

          {/* Editorial Headline, Summary, Locality & Live Counter */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCaseStory(report);
                }}
                className={`font-extrabold text-lg leading-snug line-clamp-2 mb-1 hover:text-amber-700 hover:underline transition-colors ${
                  isDismissed ? 'line-through text-slate-500' : 'text-slate-900'
                }`}
              >
                {report.title}
              </h3>
              <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                {report.summary}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 font-medium mt-2 flex-wrap gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-bold text-slate-800">{report.locality}</span>
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono text-xs text-slate-600">
                  Citizen #C-042 (Trust {trustScores.citizen}/100)
                </span>
              </div>

              <div
                className={`flex items-center gap-1 text-xs font-extrabold ${
                  isOverdue
                    ? 'text-red-600'
                    : report.status === 'RESOLVED'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{slaTimeText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dispute Review & Authority Right of Reply Box */}
        {disputeRecord && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`mb-3 p-3.5 rounded-xl border text-xs space-y-2 ${
              disputeRecord.status === 'UNDER_REVIEW'
                ? 'bg-purple-50/90 border-purple-300 text-purple-950'
                : disputeRecord.status === 'UPHELD'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-black uppercase flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Press Dispute ({disputeRecord.journalistCredential}) •{' '}
                  {disputeRecord.status === 'UNDER_REVIEW'
                    ? 'UNDER REVIEWER ARBITRATION'
                    : disputeRecord.status === 'UPHELD'
                    ? 'UPHELD (+15 Press / -12 Auth)'
                    : 'REJECTED (-10 Press)'}
                </span>
              </span>
              <span className="font-mono text-xs bg-white/80 px-2 py-0.5 rounded border border-current/20">
                Counter-Photo: {disputeRecord.counterPhotoName}
              </span>
            </div>

            <p className="font-medium leading-snug">
              <strong>Challenge Statement:</strong> &ldquo;{disputeRecord.reason}&rdquo;
            </p>

            {disputeRecord.authorityReply && (
              <div className="p-2.5 rounded-lg bg-white border border-emerald-300 text-slate-800">
                <strong className="text-emerald-800 uppercase block text-xs">
                  Official Authority Right of Reply (GNIDA Zone-3 • Trust {trustScores.authority}/100):
                </strong>
                <span>&ldquo;{disputeRecord.authorityReply}&rdquo;</span>
              </div>
            )}

            {/* Authority Right of Reply Input when logged in as Authority */}
            {isAuthenticated &&
              currentRole === 'authority' &&
              disputeRecord.status === 'UNDER_REVIEW' && (
                <div className="pt-1 space-y-1.5">
                  <label className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Post Official Authority Right of Reply (GNIDA Zone-3):</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={authorityReplyInput}
                      onChange={(e) => setAuthorityReplyInput(e.target.value)}
                      placeholder="Enter work-order verification or engineering defense for Reviewer..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (authorityReplyInput.trim()) {
                          onSubmitAuthorityReply(report.id, authorityReplyInput.trim());
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shrink-0"
                    >
                      Post Reply
                    </button>
                  </div>
                </div>
              )}

            {/* Reviewer Dispute Adjudication Buttons */}
            {isAuthenticated &&
              currentRole === 'verifier' &&
              disputeRecord.status === 'UNDER_REVIEW' && (
                <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onAdjudicateDispute(report.id, 'UPHOLD')}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all"
                  >
                    ✔ Uphold Press Dispute (Re-Open • Press +15 / Auth -12)
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjudicateDispute(report.id, 'REJECT')}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold transition-all"
                  >
                    ✖ Reject Dispute (Keep Fixed • Press -10)
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Camera GPS Verification Pill, Citizen +1 Confirm On-Site, & Case Story Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {report.exif_verified ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg text-xs border border-emerald-200">
                <span>✔ Real Camera GPS</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg text-xs border border-amber-200">
                <span>⚠ Location Mismatch</span>
              </span>
            )}

            {/* Citizen Role: +1 Confirm On-Site Button */}
            {isAuthenticated &&
              currentRole === 'citizen' &&
              report.status !== 'RESOLVED' &&
              !isDismissed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirmedOnSite) {
                      setShowConfirmPrompt(!showConfirmPrompt);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold border transition-all ${
                    confirmedOnSite
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-amber-50 text-slate-800 hover:text-amber-900 border-slate-300 hover:border-amber-400'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{confirmedOnSite ? '✔ Corroborated On-Site' : '+1 Confirm On-Site'}</span>
                </button>
              )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCaseStory(report);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 border border-amber-500/40 text-xs font-extrabold transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>Open Full Case Story →</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDetailsOpen(!isDetailsOpen);
              }}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
              title="Toggle SHA-256 & Camera Metadata"
            >
              {isDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Citizen On-Site Photo / GPS Confirmation Prompt */}
        {showConfirmPrompt && !confirmedOnSite && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2.5 animate-fade-in"
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>Citizen On-Site GPS Corroboration (#C-042)</span>
              </span>
              <span className="font-mono text-xs text-emerald-700">
                GPS Lock: {report.lat.toFixed(4)}°N, {report.lng.toFixed(4)}°E
              </span>
            </div>
            <input
              type="text"
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-800 font-medium"
              placeholder="Add quick observation note..."
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSealOnSiteConfirm}
                className="flex-1 py-1.5 px-3 bg-[#0B1120] hover:bg-slate-800 text-amber-400 rounded-lg text-xs font-extrabold transition-all"
              >
                ✔ Seal +1 On-Site Confirmation
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmPrompt(false)}
                className="py-1.5 px-3 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Digital Proof & Camera Metadata Drawer */}
        {isDetailsOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs font-mono bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 animate-fade-in"
          >
            <div className="flex items-center justify-between text-xs font-sans font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                <span>Detected Camera Hardware:</span>
              </span>
              <span className="text-slate-700 font-mono">
                {report.exif_metadata?.device || 'Unknown / Stripped EXIF'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-sans text-slate-600">
              <span className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-slate-400" />
                <span>Geo-Coordinates &amp; Offset:</span>
              </span>
              <span className="font-mono">
                {report.lat.toFixed(4)}°N, {report.lng.toFixed(4)}°E
                {report.exif_metadata?.distance_offset_m
                  ? ` (±${report.exif_metadata.distance_offset_m}m)`
                  : ''}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60">
              <div className="text-xs font-sans text-slate-500 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 font-bold">
                  <Hash className="w-3.5 h-3.5 text-amber-600" />
                  <span>SHA-256 Cryptographic Fingerprint:</span>
                </span>
                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-bold"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-700 break-all bg-white p-2 rounded-lg border border-slate-200 select-all">
                {report.evidence_hash}
              </div>
            </div>
          </div>
        )}

        {/* READ-ONLY LOCK BAR WHEN LOGGED OUT */}
        {!isAuthenticated ? (
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLoginModal();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-300 hover:border-indigo-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>🔒 Sign in via Demo Login to act</span>
            </button>
            {report.status === 'RESOLVED' && !isDisputeUpheld && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenBeforeAfterModal(report);
                }}
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-extrabold border border-emerald-300 flex items-center gap-1.5 transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Compare Before &amp; After</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ROLE 2: REVIEWER (Truth Engine Auditor • Trust 92/100) */}
            {currentRole === 'verifier' && !isDismissed && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
                {report.status === 'UNVERIFIED' ? (
                  <>
                    <div className="text-xs bg-indigo-50 text-indigo-950 px-3 py-2 rounded-lg border border-indigo-200 font-medium">
                      <strong>Auditor Action Required (Trust {trustScores.verifier}/100):</strong> Risk{' '}
                      {report.severity}/10 ({report.category}).{' '}
                      {report.exif_verified
                        ? `Camera EXIF GPS verified within ${report.exif_metadata?.distance_offset_m || 12}m.`
                        : `EXIF GPS offset (${report.exif_metadata?.distance_offset_m || 'Stripped'}m) exceeds 250m — inspect photo before approving.`}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerify(report.id, 'ESCALATE');
                        }}
                        className="flex-1 py-2 px-3 bg-[#0B1120] hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve &amp; Escalate</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerify(report.id, 'MERGE_HOTSPOT');
                        }}
                        className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-extrabold border border-amber-300 transition-all flex items-center gap-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge into Hotspot</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerify(report.id, 'REJECT');
                        }}
                        className="py-2 px-3 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-xl text-xs font-bold border border-slate-200 hover:border-red-200 transition-all"
                      >
                        Dismiss Fake
                      </button>
                    </div>
                  </>
                ) : !isUnderDisputeReview ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>✔ Already Audited &amp; Verified by Truth Engine</span>
                    </span>
                    <span className="font-mono text-slate-500">Auditor Trust: {trustScores.verifier}/100</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* ROLE 3: JOURNALIST (Accredited Press • ID #JD-204) */}
            {currentRole === 'journalist' && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromoteToEPaper(report);
                    }}
                    className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Newspaper className="w-4 h-4" />
                    <span>Promote to Front Page &amp; RTI</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPressKit(report.cluster_id || report.id);
                    }}
                    className="py-2 px-3 bg-[#0B1120] hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 transition-all border border-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Generate RTI</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                {report.status === 'RESOLVED' && !isUnderDisputeReview && !isDisputeUpheld && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDisputeModal(report);
                    }}
                    disabled={trustScores.journalist < 65 || openDisputesCount >= 3}
                    className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 rounded-xl text-xs font-extrabold border border-rose-300 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                    <span>
                      Dispute &amp; Re-Open Fix (Stake Trust {trustScores.journalist}/100 • Quota{' '}
                      {openDisputesCount}/3)
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* ROLE 4: AUTHORITY (GNIDA Official • Zone-3) & Compare Before/After */}
            {report.status === 'RESOLVED' && !isDisputeUpheld ? (
              <div className="mt-3.5 pt-3 border-t border-slate-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBeforeAfterModal(report);
                  }}
                  className="w-full py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-extrabold border border-emerald-300 shadow-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                  <span>Compare Before &amp; After Remediation Proof ({resolutionDuration})</span>
                </button>
              </div>
            ) : (
              currentRole === 'authority' &&
              !isDismissed && (
                <div className="mt-3.5 pt-3 border-t border-slate-100">
                  {report.status === 'UNVERIFIED' ? (
                    <div className="w-full py-2 px-3.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-300 flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>Locked: Awaiting Reviewer EXIF/GPS Verification</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenResolutionModal(report);
                      }}
                      className="w-full py-2.5 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                    >
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Upload &apos;After&apos; Photo Proof (Authority Trust {trustScores.authority}/100)</span>
                    </button>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};
