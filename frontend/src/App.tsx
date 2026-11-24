import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
  Report,
  UserRole,
  ToastMessage,
  AppSection,
  DemoPresetId,
  DisputeRecord,
  PublicActionLogEntry,
} from './types';
import { fetchReports, verifyReport, resetBackendDemoData } from './api';
import { Navbar } from './components/Navbar';
import { JudgeWalkthroughBar } from './components/JudgeWalkthroughBar';
import { LoginModal, DEMO_ACCOUNTS } from './components/LoginModal';
import { HomeView } from './components/HomeView';
import { MapView } from './components/MapView';
import { EPaperView } from './components/EPaperView';
import { VerifyAboutView } from './components/VerifyAboutView';
import { ReportCard } from './components/ReportCard';
import { ReportModal } from './components/ReportModal';
import { PressKitModal } from './components/PressKitModal';
import { PressDisputeModal } from './components/PressDisputeModal';
import { BeforeAfterModal } from './components/BeforeAfterModal';
import { ResolutionUploadModal } from './components/ResolutionUploadModal';
import { EvidenceLightboxModal } from './components/EvidenceLightboxModal';
import { AreaScorecardModal } from './components/AreaScorecardModal';
import { CaseStoryDrawer } from './components/CaseStoryDrawer';
import { ToastContainer } from './components/Toast';
import {
  Search,
  RefreshCw,
  Layers,
  Clock,
  CheckCircle2,
  ListFilter,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Lock,
  RotateCcw,
} from 'lucide-react';

type FilterTab = 'all' | 'clusters' | 'breached' | 'unverified' | 'resolved';

const INITIAL_TRUST_SCORES: Record<UserRole, number> = {
  citizen: 88,
  verifier: 92,
  journalist: 78,
  authority: 81,
};

const INITIAL_ACTION_LOG: PublicActionLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '14:15 IST',
    actor: 'Citizen #C-042',
    roleLabel: 'Citizen • Trust 88',
    action: 'Sealed SHA-256 photo evidence of exposed 11kV feeder pillar',
    locality: 'Knowledge Park III',
    trustDelta: '+2 Trust',
  },
  {
    id: 'log-2',
    timestamp: '16:40 IST',
    actor: 'Auditor #AUD-01',
    roleLabel: 'Reviewer • Trust 92',
    action: 'Merged 4 corroborated reports within 200m into Hotspot #63007a',
    locality: 'Knowledge Park III',
    trustDelta: '+3 Trust',
  },
  {
    id: 'log-3',
    timestamp: '18:00 IST',
    actor: 'GNIDA Zone-3',
    roleLabel: 'Authority • Trust 81',
    action: 'Uploaded After-photo proof under Work-Order GNIDA/Z3/2026/WO-419 (Fixed in 11h)',
    locality: 'Knowledge Park III',
    trustDelta: '+5 Trust',
  },
  {
    id: 'log-4',
    timestamp: '19:10 IST',
    actor: 'Press #JD-204',
    roleLabel: 'Journalist • Trust 78',
    action: 'Generated Section 6(1) & 7(1) 48-Hour Life-Safety RTI Notice PDF',
    locality: 'Pari Chowk',
    trustDelta: 'RTI Filed',
  },
];

export const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation & Controlled Demo Login RBAC State
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [activePreset, setActivePreset] = useState<DemoPresetId | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('citizen');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Live Trust Score Engine (0–100) & Public Action Log
  const [trustScores, setTrustScores] = useState<Record<UserRole, number>>(INITIAL_TRUST_SCORES);
  const [actionLog, setActionLog] = useState<PublicActionLogEntry[]>(INITIAL_ACTION_LOG);

  // Guided 6-Step Judge Walkthrough Bar (collapsed by default on page load)
  const [showWalkthrough, setShowWalkthrough] = useState<boolean>(false);
  const [walkthroughStep, setWalkthroughStep] = useState<number>(1);

  // Map & Feed UI state
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [hoveredReportId, setHoveredReportId] = useState<string | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Dynamic Reversal & Reviewer-Mediated Dispute states
  const [caseStoryReportId, setCaseStoryReportId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [disputeRecords, setDisputeRecords] = useState<Record<string, DisputeRecord>>({});
  const [workOrderIds, setWorkOrderIds] = useState<Record<string, string>>({});
  const [pressEscalatedIds, setPressEscalatedIds] = useState<Record<string, boolean>>({
    '60722f33-473f-4bd5-a892-56ffc5ecd8dc': true,
  });
  const [ePaperLeadId, setEPaperLeadId] = useState<string | null>(null);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [pressKitClusterId, setPressKitClusterId] = useState<string | null>(null);
  const [beforeAfterReport, setBeforeAfterReport] = useState<Report | null>(null);
  const [resolutionReport, setResolutionReport] = useState<Report | null>(null);
  const [disputeModalReport, setDisputeModalReport] = useState<Report | null>(null);
  const [lightboxReport, setLightboxReport] = useState<Report | null>(null);

  // Single Active Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const cardListRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = activePreset !== null;
  const isAdmin = activePreset === 'admin';

  const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = `${Date.now()}-${Math.random()}`;
    setToasts([{ id, message, type }]);
    toastTimerRef.current = window.setTimeout(() => {
      setToasts([]);
      toastTimerRef.current = null;
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const appendActionLog = (
    actor: string,
    roleLabel: string,
    action: string,
    locality: string,
    trustDelta?: string
  ) => {
    const nowStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setActionLog((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        actor,
        roleLabel,
        action,
        locality,
        trustDelta,
      },
      ...prev.slice(0, 14),
    ]);
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReports();
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Jan Drishti Truth Engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleSelectLoginPreset = (presetId: DemoPresetId) => {
    const acc = DEMO_ACCOUNTS[presetId];
    setActivePreset(presetId);
    setCurrentRole(acc.role);
    addToast(
      `Signed in as ${acc.title} (${acc.credential} • Trust ${
        presetId === 'admin' ? 99 : trustScores[acc.role]
      }/100)`,
      'info'
    );
  };

  const handleLogout = () => {
    setActivePreset(null);
    addToast('Signed out — Live Command Map switched to Read-Only Public Mode', 'info');
  };

  const handleResetDemoData = async () => {
    setDismissedIds({});
    setDisputeRecords({});
    setWorkOrderIds({});
    setPressEscalatedIds({ '60722f33-473f-4bd5-a892-56ffc5ecd8dc': true });
    setTrustScores(INITIAL_TRUST_SCORES);
    setActionLog(INITIAL_ACTION_LOG);
    setActiveTab('all');
    setSearchQuery('');
    const fresh = await resetBackendDemoData();
    setReports(fresh);
    addToast(
      'DEMO DATA RESET: Restored all 16 Greater Noida reports, local /evidence/ photos & Trust Scores!',
      'success'
    );
  };

  // Count active open disputes (UNDER_REVIEW) for Journalist quota (max 3)
  const openDisputesCount = useMemo(
    () =>
      Object.values(disputeRecords).filter((d) => d.status === 'UNDER_REVIEW').length,
    [disputeRecords]
  );

  // Compute cluster counts
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      if (r.cluster_id) {
        counts[r.cluster_id] = (counts[r.cluster_id] || 0) + 1;
      }
    });
    return counts;
  }, [reports]);

  // Role Queue counts
  const roleQueueStats = useMemo(() => {
    const unverifiedCount = reports.filter(
      (r) => r.status === 'UNVERIFIED' && !dismissedIds[r.id]
    ).length;
    const underReviewDisputes = Object.values(disputeRecords).filter(
      (d) => d.status === 'UNDER_REVIEW'
    ).length;
    const overdueCount = reports.filter(
      (r) =>
        (r.status === 'SLA_BREACHED' || disputeRecords[r.id]?.status === 'UPHELD') &&
        !dismissedIds[r.id]
    ).length;
    const activeForAuthority = reports.filter(
      (r) =>
        (r.status === 'SLA_BREACHED' ||
          r.status === 'ESCALATED' ||
          disputeRecords[r.id]?.status === 'UPHELD' ||
          disputeRecords[r.id]?.status === 'UNDER_REVIEW') &&
        !dismissedIds[r.id]
    ).length;
    const hotspotsCount = Object.values(clusterCounts).filter((c) => c >= 2).length;
    return {
      unverifiedCount,
      underReviewDisputes,
      overdueCount,
      activeForAuthority,
      hotspotsCount,
    };
  }, [reports, clusterCounts, dismissedIds, disputeRecords]);

  // Filtered + Smart Role-Sorted reports
  const filteredReports = useMemo(() => {
    const base = reports.filter((report) => {
      const disp = disputeRecords[report.id];
      if (
        activeTab === 'clusters' &&
        (!report.cluster_id || (clusterCounts[report.cluster_id] || 0) < 2)
      ) {
        return false;
      }
      if (
        activeTab === 'breached' &&
        report.status !== 'SLA_BREACHED' &&
        disp?.status !== 'UPHELD' &&
        disp?.status !== 'UNDER_REVIEW'
      ) {
        return false;
      }
      if (
        activeTab === 'unverified' &&
        report.status !== 'UNVERIFIED' &&
        disp?.status !== 'UNDER_REVIEW'
      ) {
        return false;
      }
      if (
        activeTab === 'resolved' &&
        (report.status !== 'RESOLVED' || disp?.status === 'UPHELD')
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          report.title.toLowerCase().includes(q) ||
          report.locality.toLowerCase().includes(q) ||
          report.category.toLowerCase().includes(q) ||
          report.summary.toLowerCase().includes(q)
        );
      }

      return true;
    });

    return [...base].sort((a, b) => {
      const dispA = disputeRecords[a.id];
      const dispB = disputeRecords[b.id];

      if (currentRole === 'verifier') {
        // Reviewer: sort Under Dispute Review & Needs Check (UNVERIFIED) to the top
        const getRevPriority = (r: Report, d?: DisputeRecord) => {
          if (d?.status === 'UNDER_REVIEW') return 3;
          if (r.status === 'UNVERIFIED' && !dismissedIds[r.id]) return 2;
          return 1;
        };
        const diff = getRevPriority(b, dispB) - getRevPriority(a, dispA);
        if (diff !== 0) return diff;
      } else if (currentRole === 'journalist') {
        const getJournPriority = (r: Report, d?: DisputeRecord) => {
          if (d?.status === 'UNDER_REVIEW' || d?.status === 'UPHELD') return 4;
          if (r.status === 'SLA_BREACHED') return 3;
          if (r.status === 'RESOLVED') return 2;
          return 1;
        };
        const diff = getJournPriority(b, dispB) - getJournPriority(a, dispA);
        if (diff !== 0) return diff;
      } else if (currentRole === 'authority') {
        const getAuthPriority = (r: Report, d?: DisputeRecord) => {
          if (r.status === 'UNVERIFIED') return 0;
          if (d?.status === 'UNDER_REVIEW' || d?.status === 'UPHELD') return 4;
          if (r.status === 'SLA_BREACHED') return 3;
          if (r.status === 'ESCALATED') return 2;
          return 1;
        };
        const diff = getAuthPriority(b, dispB) - getAuthPriority(a, dispA);
        if (diff !== 0) return diff;
      }
      return b.severity - a.severity;
    });
  }, [
    reports,
    activeTab,
    searchQuery,
    clusterCounts,
    disputeRecords,
    dismissedIds,
    currentRole,
  ]);

  const handleSelectReport = (id: string) => {
    setSelectedReportId(id);
    const target = reports.find((r) => r.id === id);
    if (target) {
      setFlyToLocation({ lat: target.lat, lng: target.lng });
    }
    const cardEl = document.getElementById(`report-card-${id}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Reviewer & Journalist actions
  const handleVerify = async (
    id: string,
    action: 'ESCALATE' | 'REJECT' | 'DISPUTE' | 'MERGE_HOTSPOT'
  ) => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }

    const target = reports.find((r) => r.id === id);

    if (action === 'REJECT') {
      setDismissedIds((prev) => ({ ...prev, [id]: true }));
      setTrustScores((prev) => ({
        ...prev,
        verifier: Math.min(100, prev.verifier + 1),
      }));
      appendActionLog(
        'Reviewer #AUD-01',
        'Truth Engine Auditor',
        `Dismissed unverified report #${id.substring(0, 6)} for EXIF/GPS mismatch`,
        target?.locality || 'Greater Noida',
        '+1 Trust'
      );
      addToast('CASE DISMISSED: Flagged by Truth Engine Auditor for GPS/EXIF tampering!', 'warning');
      return;
    }

    if (action === 'DISPUTE') {
      if (target) {
        setDisputeModalReport(target);
      }
      return;
    }

    if (action === 'MERGE_HOTSPOT') {
      const hotspotCid = '63007a96-1cb2-4d78-b2ee-5aa6e9f33677';
      setDismissedIds((prev) => ({ ...prev, [id]: false }));
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, cluster_id: hotspotCid, status: 'ESCALATED', exif_verified: true }
            : r
        )
      );
      verifyReport(id, 'MERGE_HOTSPOT').catch(() => {});
      appendActionLog(
        'Reviewer #AUD-01',
        'Truth Engine Auditor',
        `Merged report #${id.substring(0, 6)} into 200m Corroborated Hotspot`,
        target?.locality || 'Knowledge Park III',
        '+2 Trust'
      );
      addToast('MERGED INTO HOTSPOT: Linked to Knowledge Park III 200m Corroborated Cluster!', 'info');
      return;
    }

    try {
      setDismissedIds((prev) => ({ ...prev, [id]: false }));
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'ESCALATED', exif_verified: true } : r
        )
      );
      setTrustScores((prev) => ({
        ...prev,
        verifier: Math.min(100, prev.verifier + 2),
        citizen: Math.min(100, prev.citizen + 2),
      }));
      appendActionLog(
        'Reviewer #AUD-01',
        'Truth Engine Auditor',
        `Approved & escalated report #${id.substring(0, 6)} to Action Needed`,
        target?.locality || 'Greater Noida',
        '+2 Trust'
      );
      await verifyReport(id, 'ESCALATE');
      addToast('CASE APPROVED & ESCALATED: EXIF/GPS verified — moved to Action Needed!', 'success');
    } catch {
      addToast('CASE APPROVED & ESCALATED: EXIF/GPS verified — moved to Action Needed!', 'success');
    }
  };

  // Step 1 of Dispute: Journalist stakes Trust with written reason + counter-photo -> sets Under Dispute Review
  const handleConfirmDispute = (
    reportId: string,
    reason: string,
    counterPhotoUrl: string,
    counterPhotoName: string
  ) => {
    const target = reports.find((r) => r.id === reportId);
    const record: DisputeRecord = {
      reportId,
      status: 'UNDER_REVIEW',
      journalistCredential: 'Accredited Press #JD-204',
      reason,
      counterPhotoUrl,
      counterPhotoName,
      createdAt: new Date().toISOString(),
    };
    setDisputeRecords((prev) => ({ ...prev, [reportId]: record }));
    setPressEscalatedIds((prev) => ({ ...prev, [reportId]: true }));
    setDisputeModalReport(null);
    appendActionLog(
      'Press #JD-204',
      `Journalist • Trust ${trustScores.journalist}`,
      `Opened counter-photo dispute ("${reason.substring(0, 48)}...") — Under Dispute Review`,
      target?.locality || 'Greater Noida',
      'Staked -10/+15'
    );
    addToast(
      'UNDER DISPUTE REVIEW: Counter-photo logged! Authority Right of Reply & Reviewer Arbitration unlocked.',
      'warning'
    );
  };

  // Step 2 of Dispute: Authority posts Official Right of Reply
  const handleSubmitAuthorityReply = (reportId: string, replyText: string) => {
    const target = reports.find((r) => r.id === reportId);
    setDisputeRecords((prev) => {
      const existing = prev[reportId];
      if (!existing) return prev;
      return {
        ...prev,
        [reportId]: {
          ...existing,
          authorityReply: replyText,
          authorityRepliedAt: new Date().toISOString(),
        },
      };
    });
    appendActionLog(
      'GNIDA Zone-3',
      `Authority • Trust ${trustScores.authority}`,
      `Posted Official Right of Reply on disputed ticket #${reportId.substring(0, 6)}`,
      target?.locality || 'Greater Noida',
      'Reply Logged'
    );
    addToast('AUTHORITY RIGHT OF REPLY POSTED: Attached to dispute record for Reviewer arbitration!', 'info');
  };

  // Step 3 of Dispute: Reviewer adjudicates (UPHOLD -> Re-opens ticket, Press +15, Authority -12; REJECT -> Keeps verified, Press -10)
  const handleAdjudicateDispute = (reportId: string, verdict: 'UPHOLD' | 'REJECT') => {
    const target = reports.find((r) => r.id === reportId);
    if (verdict === 'UPHOLD') {
      setDisputeRecords((prev) => {
        const existing = prev[reportId];
        if (!existing) return prev;
        return {
          ...prev,
          [reportId]: {
            ...existing,
            status: 'UPHELD',
            resolvedAt: new Date().toISOString(),
          },
        };
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'SLA_BREACHED' } : r))
      );
      setTrustScores((prev) => ({
        ...prev,
        journalist: Math.min(100, prev.journalist + 15),
        authority: Math.max(0, prev.authority - 12),
      }));
      verifyReport(reportId, 'DISPUTE').catch(() => {});
      appendActionLog(
        'Reviewer #AUD-01',
        'Truth Engine Auditor',
        `UPHELD Press Dispute on #${reportId.substring(0, 6)} — Re-opened ticket to Overdue`,
        target?.locality || 'Greater Noida',
        'Press +15 / Auth -12'
      );
      addToast(
        'DISPUTE UPHELD BY REVIEWER: Ticket re-opened to Overdue! (Journalist +15 Trust, Authority -12 Trust)',
        'error'
      );
    } else {
      setDisputeRecords((prev) => {
        const existing = prev[reportId];
        if (!existing) return prev;
        return {
          ...prev,
          [reportId]: {
            ...existing,
            status: 'REJECTED',
            resolvedAt: new Date().toISOString(),
          },
        };
      });
      setTrustScores((prev) => ({
        ...prev,
        journalist: Math.max(0, prev.journalist - 10),
      }));
      appendActionLog(
        'Reviewer #AUD-01',
        'Truth Engine Auditor',
        `REJECTED Press Dispute on #${reportId.substring(0, 6)} — Remediation kept Fixed & Verified`,
        target?.locality || 'Greater Noida',
        'Press -10 Trust'
      );
      addToast(
        'DISPUTE REJECTED BY REVIEWER: Ticket remains Fixed & Verified! (Journalist -10 Trust)',
        'info'
      );
    }
  };

  const handlePromoteToEPaper = (rep: Report) => {
    setPressEscalatedIds((prev) => ({ ...prev, [rep.id]: true }));
    setEPaperLeadId(rep.id);
    setPressKitClusterId(rep.cluster_id || rep.id);
    appendActionLog(
      'Press #JD-204',
      `Journalist • Trust ${trustScores.journalist}`,
      `Promoted "${rep.title.substring(0, 42)}..." to Front-Page e-Paper & RTI Dossier`,
      rep.locality,
      'Front Page'
    );
    addToast(
      `PRESS ESCALATED (#JD-204): "${rep.locality}" promoted to Front-Page Lead & Instant RTI Dossier!`,
      'info'
    );
  };

  // 6-Step Guided Judge Walkthrough Controller
  const handleRunWalkthroughStep = (step: number) => {
    // Cleanly close any open modals/drawers from previous steps so out-of-order clicks never overlap
    setIsReportModalOpen(false);
    setPressKitClusterId(null);
    setResolutionReport(null);
    setDisputeModalReport(null);
    setBeforeAfterReport(null);
    setCaseStoryReportId(null);
    setIsLoginModalOpen(false);

    setWalkthroughStep(step);
    setActivePreset('admin'); // Give Judge Super-Admin access during walkthrough

    if (step === 1) {
      setCurrentRole('citizen');
      setActiveSection('map');
      setActiveTab('all');
      setIsReportModalOpen(true);
      addToast('Walkthrough Step 1/6: Citizen Report — Upload photo or click +1 Confirm On-Site', 'info');
    } else if (step === 2) {
      setCurrentRole('verifier');
      setActiveSection('map');
      setActiveTab('all');
      const unv = reports.find((r) => r.status === 'UNVERIFIED' && !dismissedIds[r.id]);
      if (unv) handleSelectReport(unv.id);
      addToast('Walkthrough Step 2/6: Reviewer Queue — Needs Check sorted to top! Click Approve & Escalate.', 'info');
    } else if (step === 3) {
      setCurrentRole('journalist');
      setActiveSection('map');
      setActiveTab('all');
      const overdueLead =
        reports.find((r) => r.id === '60722f33-473f-4bd5-a892-56ffc5ecd8dc') ||
        reports.find((r) => r.status === 'SLA_BREACHED') ||
        reports[0];
      if (overdueLead) {
        handleSelectReport(overdueLead.id);
        setPressKitClusterId(overdueLead.cluster_id || overdueLead.id);
      }
      addToast('Walkthrough Step 3/6: Journalist Promote & Instant 0ms Cached RTI Dossier', 'info');
    } else if (step === 4) {
      setCurrentRole('authority');
      setActiveSection('map');
      setActiveTab('all');
      const targetFix =
        reports.find((r) => r.status === 'SLA_BREACHED' || r.status === 'ESCALATED') ||
        reports[0];
      if (targetFix) {
        handleSelectReport(targetFix.id);
        setResolutionReport(targetFix);
      }
      addToast('Walkthrough Step 4/6: Authority Upload After-Photo with Work-Order ID', 'info');
    } else if (step === 5) {
      setCurrentRole('journalist');
      setActiveSection('map');
      setActiveTab('all');
      const resolvedRep =
        reports.find((r) => r.status === 'RESOLVED' && !disputeRecords[r.id]) ||
        reports.find((r) => r.status === 'RESOLVED') ||
        reports[0];
      if (resolvedRep) {
        handleSelectReport(resolvedRep.id);
        setDisputeModalReport(resolvedRep);
      }
      addToast('Walkthrough Step 5/6: Press Dispute Staking (-10/+15 Trust) & Authority Right of Reply', 'info');
    } else if (step === 6) {
      setActiveSection('scorecard');
      const resolvedRep = reports.find((r) => r.status === 'RESOLVED');
      if (resolvedRep) {
        setBeforeAfterReport(resolvedRep);
      }
      addToast('Walkthrough Step 6/6: Before/After Split Slider & 4-Role Trust Leaderboard!', 'success');
    }
  };

  const activeCaseStoryReport = useMemo(
    () => reports.find((r) => r.id === caseStoryReportId) || null,
    [reports, caseStoryReportId]
  );

  const rolePills: {
    id: UserRole;
    num: string;
    label: string;
    credential: string;
    badge: string;
  }[] = [
    {
      id: 'citizen',
      num: '1',
      label: 'Citizen',
      credential: `#C-042 • Trust ${trustScores.citizen}/100`,
      badge: `${reports.length} Sealed`,
    },
    {
      id: 'verifier',
      num: '2',
      label: 'Reviewer',
      credential: `Auditor • Trust ${trustScores.verifier}/100`,
      badge: `${roleQueueStats.unverifiedCount + roleQueueStats.underReviewDisputes} to Audit`,
    },
    {
      id: 'journalist',
      num: '3',
      label: 'Journalist',
      credential: `#JD-204 • Trust ${trustScores.journalist}/100`,
      badge: `${roleQueueStats.overdueCount} Overdue`,
    },
    {
      id: 'authority',
      num: '4',
      label: 'Authority',
      credential: `Zone-3 • Trust ${trustScores.authority}/100`,
      badge: `${roleQueueStats.activeForAuthority} Pending Fix`,
    },
  ];

  const getRoleInstructionBanner = () => {
    if (!isAuthenticated) {
      return {
        title: '🔒 Public Read-Only Mode (Sign in via Demo Login to Act)',
        desc: 'You are viewing the live Greater Noida accountability grid in Read-Only mode. Click "Demo Login" to test Citizen, Reviewer, Journalist, Authority, or Demo Admin powers.',
        color: 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200',
      };
    }
    switch (currentRole) {
      case 'citizen':
        return {
          title: `1. Citizen Workspace (Verified Citizen #C-042 • Trust ${trustScores.citizen}/100)`,
          desc: 'Submit new photo reports (+ Report a Problem) or click "+1 Confirm On-Site" to seal a GPS corroboration. Citizens cannot close or delete tickets.',
          color: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
        };
      case 'verifier':
        return {
          title: `2. Reviewer Queue (Truth Engine Auditor • Trust ${trustScores.verifier}/100 • ${
            roleQueueStats.unverifiedCount + roleQueueStats.underReviewDisputes
          } Sorted to Top)`,
          desc: 'Needs Check & Under Dispute Review cards sorted to top. Approve & Escalate, Merge into Hotspot, Dismiss Fake, or adjudicate Press Disputes.',
          color: 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200',
        };
      case 'journalist':
        return {
          title: `3. Journalist Desk (Accredited Press #JD-204 • Trust ${trustScores.journalist}/100 • Active Disputes: ${openDisputesCount}/3)`,
          desc: 'Promote overdue hotspots to Front Page & RTI, or stake Trust (-10/+15) with counter-photo evidence on Fixed cards (requires Trust ≥ 65, < 3 disputes).',
          color: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
        };
      case 'authority':
        return {
          title: `4. Authority Queue (GNIDA Official Zone-3 • Trust ${trustScores.authority}/100 • ${roleQueueStats.activeForAuthority} Active)`,
          desc: 'Upload After-Photo Proof with a Work-Order ID on verified tickets, or post an official Right of Reply on Under Dispute Review cases.',
          color: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
        };
    }
  };

  const roleBanner = getRoleInstructionBanner();

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F1F5F9]">
      {/* 5-Section Command Topbar */}
      <Navbar
        activeSection={activeSection}
        activePreset={activePreset}
        currentRole={currentRole}
        trustScores={trustScores}
        showWalkthrough={showWalkthrough}
        onToggleWalkthrough={() => setShowWalkthrough((v) => !v)}
        onSectionChange={setActiveSection}
        onOpenReportModal={() => {
          if (!isAuthenticated) {
            setIsLoginModalOpen(true);
            addToast('Please sign in as Citizen or Demo Admin to submit a report', 'info');
            return;
          }
          setIsReportModalOpen(true);
        }}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onResetDemoData={handleResetDemoData}
      />

      {/* Collapsible 6-Step Guided Judge Walkthrough Bar */}
      <JudgeWalkthroughBar
        isOpen={showWalkthrough}
        activeStep={walkthroughStep}
        onSelectStep={handleRunWalkthroughStep}
        onClose={() => setShowWalkthrough(false)}
      />

      <main className="flex-1 flex flex-col pb-16">
      {/* SECTION 1: HOME */}
      {activeSection === 'home' && (
        <HomeView
          reports={reports}
          clusterCounts={clusterCounts}
          actionLog={actionLog}
          activePreset={activePreset}
          onNavigate={setActiveSection}
          onOpenReportModal={() => {
            if (!isAuthenticated) {
              setIsLoginModalOpen(true);
              return;
            }
            setIsReportModalOpen(true);
          }}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onOpenPressKit={(clusterId) => setPressKitClusterId(clusterId)}
        />
      )}

      {/* SECTION 2: LIVE COMMAND MAP (Stacks cleanly on mobile 390px, 45%/55% split on desktop) */}
      {activeSection === 'map' && (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Left 45% (Desktop) / Top 360px (Mobile) - OpenStreetMap */}
          <section className="w-full h-[360px] lg:w-[45%] lg:h-[calc(100dvh-3.5rem)] lg:sticky lg:top-0 shrink-0 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/30 shadow-inner">
            <MapView
              reports={filteredReports.filter((r) => !dismissedIds[r.id])}
              disputeRecords={disputeRecords}
              selectedReportId={selectedReportId}
              hoveredReportId={hoveredReportId}
              onSelectReport={handleSelectReport}
              onOpenCaseStory={(rep) => setCaseStoryReportId(rep.id)}
              onOpenBeforeAfterModal={(rep) => setBeforeAfterReport(rep)}
              flyToLocation={flyToLocation}
            />
          </section>

          {/* Right 55% - Unified Single-Column Scrolling Report Feed */}
          <section className="w-full flex-1 lg:w-[55%] lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto overscroll-contain flex flex-col bg-[#F1F5F9] scroll-smooth">
            {/* Deep Midnight Slate Sticky RBAC & Filter Controls */}
            <div className="bg-[#0B1120] text-white px-5 py-3 border-b border-slate-800 shrink-0 space-y-2.5 shadow-md">
              {/* Role Governance Bar: Full 4-Role Switcher when Signed In, or Read-Only Sign-In CTA when Logged Out */}
              {isAuthenticated ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-mono font-extrabold text-amber-400 uppercase">
                      {isAdmin
                        ? '★ Demo Admin Super-Mode — Click Any Role Below to Switch Pipeline View:'
                        : `● Authenticated (${DEMO_ACCOUNTS[activePreset!].title}) — 1-Click Role Switcher:`}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsLoginModalOpen(true)}
                        className="text-xs font-extrabold text-indigo-300 hover:text-white underline"
                      >
                        Account / Logout
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDemoData}
                        className="text-xs font-extrabold text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Demo Data</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/95 p-1.5 rounded-xl border border-slate-800">
                    {rolePills.map((rp, idx) => {
                      const isActive = currentRole === rp.id;
                      return (
                        <button
                          key={rp.id}
                          type="button"
                          onClick={() => {
                            setCurrentRole(rp.id);
                            if (!isAdmin) {
                              setActivePreset(rp.id);
                            }
                            addToast(`Switched Active Role to ${rp.label} (${rp.credential})`, 'info');
                          }}
                          className={`relative flex flex-col justify-between p-2 rounded-lg text-left transition-all ${
                            isActive
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md'
                              : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-0.5">
                            <span
                              className={`text-xs font-mono font-black px-1.5 py-0.2 rounded ${
                                isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {rp.num}. {rp.label}
                            </span>
                            {idx < 3 && (
                              <ChevronRight
                                className={`w-3.5 h-3.5 hidden sm:block ${
                                  isActive ? 'text-slate-950' : 'text-slate-600'
                                }`}
                              />
                            )}
                          </div>
                          <div
                            className={`text-xs font-medium truncate ${
                              isActive ? 'text-slate-900 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {rp.credential}
                          </div>
                          <div
                            className={`mt-1 inline-block text-xs font-mono font-extrabold px-1.5 py-0.5 rounded ${
                              isActive
                                ? 'bg-slate-950/15 text-slate-950'
                                : 'bg-slate-800/90 text-amber-400'
                            }`}
                          >
                            {rp.badge}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-900/95 px-3.5 py-2 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 text-xs">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-slate-200">
                      🔒 Sign in via Demo Login to unlock 4-Role Switcher &amp; Actions (Currently in Public Read-Only Mode)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all"
                  >
                    Open Demo Login →
                  </button>
                </div>
              )}

              {/* Dynamic Role Instruction Banner */}
              <div className={`px-3.5 py-2 rounded-xl border text-xs ${roleBanner.color}`}>
                <div className="font-extrabold">{roleBanner.title}</div>
                <div className="opacity-95 leading-snug mt-0.5">{roleBanner.desc}</div>
              </div>

              {/* Search Bar + Filter Chips */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter by sector or hazard (e.g. Knowledge Park, Beta 2, Pari Chowk, Alpha 1)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium"
                  />
                </div>

                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-amber-400 text-xs font-bold"
                  >
                    Clear Filter
                  </button>
                )}

                <button
                  onClick={loadReports}
                  title="Refresh Live Intelligence Feed"
                  className="p-2 rounded-xl border border-slate-700/80 bg-slate-900 text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>

              {/* Horizontally Scrollable Unclipped Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-0.5 text-xs font-extrabold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  All Reports ({reports.length})
                </button>

                <button
                  onClick={() => setActiveTab('clusters')}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'clusters'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Citizen Hotspots</span>
                </button>

                <button
                  onClick={() => setActiveTab('breached')}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'breached'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-900 text-red-400 hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Overdue ({roleQueueStats.overdueCount})</span>
                </button>

                <button
                  onClick={() => setActiveTab('unverified')}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'unverified'
                      ? 'bg-slate-200 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Needs Check / Dispute ({roleQueueStats.unverifiedCount + roleQueueStats.underReviewDisputes})
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('resolved')}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === 'resolved'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Fixed &amp; Verified</span>
                </button>
              </div>
            </div>

            {/* Feed Cards List */}
            <div
              ref={cardListRef}
              className="flex-1 min-h-[60vh] p-5 pb-16 space-y-4 bg-[#F1F5F9]"
            >
              {loading && reports.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse space-y-3 shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <div className="w-28 h-5 bg-slate-200 rounded-md"></div>
                        <div className="w-16 h-5 bg-slate-200 rounded-md"></div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-24 h-24 bg-slate-200 rounded-xl shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="w-3/4 h-5 bg-slate-200 rounded"></div>
                          <div className="w-full h-3 bg-slate-200 rounded"></div>
                          <div className="w-2/3 h-3 bg-slate-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-2 shadow-sm">
                  <div className="font-extrabold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Truth Engine Service Notice
                  </div>
                  <p>{error}</p>
                  <button
                    onClick={loadReports}
                    className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg font-bold text-xs shadow-xs"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <ListFilter className="w-10 h-10 mx-auto text-slate-300" />
                  <div className="text-sm font-bold text-slate-700">No matching civic reports</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Switch filter tabs above or clear your search query to view all Greater Noida evidence cards.
                  </p>
                </div>
              ) : (
                filteredReports.map((report, index) => (
                  <div key={report.id} id={`report-card-${report.id}`}>
                    <ReportCard
                      report={report}
                      pinNumber={index + 1}
                      isDismissed={!!dismissedIds[report.id]}
                      disputeRecord={disputeRecords[report.id]}
                      workOrderId={workOrderIds[report.id]}
                      isPressEscalated={!!pressEscalatedIds[report.id]}
                      clusterCount={report.cluster_id ? clusterCounts[report.cluster_id] || 1 : 1}
                      isSelected={report.id === selectedReportId}
                      isAuthenticated={isAuthenticated}
                      currentRole={currentRole}
                      trustScores={trustScores}
                      openDisputesCount={openDisputesCount}
                      onSelect={() => handleSelectReport(report.id)}
                      onHover={(id) => setHoveredReportId(id)}
                      onOpenLoginModal={() => setIsLoginModalOpen(true)}
                      onOpenCaseStory={(rep) => setCaseStoryReportId(rep.id)}
                      onVerify={handleVerify}
                      onOpenPressKit={(clusterId) => setPressKitClusterId(clusterId)}
                      onPromoteToEPaper={handlePromoteToEPaper}
                      onOpenResolutionModal={(rep) => setResolutionReport(rep)}
                      onOpenDisputeModal={(rep) => setDisputeModalReport(rep)}
                      onSubmitAuthorityReply={handleSubmitAuthorityReply}
                      onAdjudicateDispute={handleAdjudicateDispute}
                      onOpenBeforeAfterModal={(rep) => setBeforeAfterReport(rep)}
                      onOpenLightbox={(rep) => setLightboxReport(rep)}
                      onConfirmOnSite={(rep) => {
                        setTrustScores((prev) => ({
                          ...prev,
                          citizen: Math.min(100, prev.citizen + 1),
                        }));
                        appendActionLog(
                          'Citizen #C-042',
                          `Citizen • Trust ${trustScores.citizen + 1}`,
                          `Sealed +1 On-Site GPS corroboration for "${rep.title.substring(0, 36)}..."`,
                          rep.locality,
                          '+1 Trust'
                        );
                        addToast(
                          `+1 Citizen GPS Corroboration sealed for "${rep.locality}" (+1 Citizen Trust)!`,
                          'success'
                        );
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 3: JAN DRISHTI E-PAPER */}
      {activeSection === 'epaper' && (
        <EPaperView
          reports={reports}
          initialLeadId={ePaperLeadId}
          clusterCounts={clusterCounts}
          onOpenPressKit={(clusterId) => setPressKitClusterId(clusterId)}
          onOpenCaseStory={(rep) => setCaseStoryReportId(rep.id)}
          onOpenLightbox={(rep) => setLightboxReport(rep)}
          onToast={(msg) => addToast(msg, 'success')}
        />
      )}

      {/* SECTION 4: AREA SCORECARD & TRUST LEADERBOARD */}
      {activeSection === 'scorecard' && (
        <AreaScorecardModal
          isOpen={true}
          inlinePage={true}
          reports={reports}
          dismissedIds={dismissedIds}
          disputeRecords={disputeRecords}
          trustScores={trustScores}
          onOpenBeforeAfterModal={(rep) => setBeforeAfterReport(rep)}
          onSelectSectorOnMap={(loc) => {
            setSearchQuery(loc.split(' ')[0]);
            setActiveTab('all');
            setActiveSection('map');
            addToast(`Filtered Live Command Map to ${loc}`, 'info');
          }}
        />
      )}

      {/* SECTION 5: VERIFY & ABOUT */}
      {activeSection === 'verify' && (
        <VerifyAboutView
          reports={reports}
          onOpenCaseStory={(rep) => setCaseStoryReportId(rep.id)}
        />
      )}
      </main>

      {/* OFFICIAL HACKATHON CREDITS FOOTER BAR (Static bottom-of-page footer) */}
      <footer className="mt-auto bg-[#0B1120] border-t border-slate-800/90 text-slate-400 px-6 py-3 flex items-center justify-between text-xs select-none flex-wrap gap-2">
        <div className="flex items-center gap-2 font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Jan Drishti (&ldquo;Through the Eyes of the People&rdquo;) • Civic Accountability &amp; Truth Engine</span>
        </div>
        <div className="font-bold text-amber-400">
          Naitik Baweja &amp; Team • Manthankriti 2026 • Delhi Technical Campus
        </div>
      </footer>

      {/* GLOBAL MODALS & DRAWERS */}
      <LoginModal
        isOpen={isLoginModalOpen}
        activePreset={activePreset}
        trustScores={trustScores}
        openDisputesCount={openDisputesCount}
        onClose={() => setIsLoginModalOpen(false)}
        onSelectPreset={handleSelectLoginPreset}
        onLogout={handleLogout}
        onResetDemoData={handleResetDemoData}
      />

      <CaseStoryDrawer
        report={activeCaseStoryReport}
        isDismissed={activeCaseStoryReport ? !!dismissedIds[activeCaseStoryReport.id] : false}
        disputeRecord={activeCaseStoryReport ? disputeRecords[activeCaseStoryReport.id] : undefined}
        workOrderId={activeCaseStoryReport ? workOrderIds[activeCaseStoryReport.id] : undefined}
        isPressEscalated={
          activeCaseStoryReport ? !!pressEscalatedIds[activeCaseStoryReport.id] : false
        }
        clusterCount={
          activeCaseStoryReport?.cluster_id
            ? clusterCounts[activeCaseStoryReport.cluster_id] || 1
            : 1
        }
        isAuthenticated={isAuthenticated}
        currentRole={currentRole}
        trustScores={trustScores}
        openDisputesCount={openDisputesCount}
        onClose={() => setCaseStoryReportId(null)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onVerify={handleVerify}
        onOpenPressKit={(clusterId) => setPressKitClusterId(clusterId)}
        onOpenResolutionModal={(rep) => setResolutionReport(rep)}
        onOpenDisputeModal={(rep) => setDisputeModalReport(rep)}
        onSubmitAuthorityReply={handleSubmitAuthorityReply}
        onAdjudicateDispute={handleAdjudicateDispute}
        onOpenBeforeAfterModal={(rep) => setBeforeAfterReport(rep)}
        onNavigateToEPaper={(repId) => {
          const target = reports.find((r) => r.id === repId);
          setPressEscalatedIds((prev) => ({ ...prev, [repId]: true }));
          setEPaperLeadId(repId);
          if (target) {
            setPressKitClusterId(target.cluster_id || target.id);
          }
          setActiveSection('epaper');
          addToast('Promoted to Front-Page Broadsheet e-Paper & opened Media/RTI Dossier!', 'info');
        }}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportSubmitted={(msg, createdReport) => {
          if (createdReport) {
            setReports((prev) => {
              const exists = prev.some((r) => r.id === createdReport.id);
              return exists
                ? prev.map((r) => (r.id === createdReport.id ? createdReport : r))
                : [createdReport, ...prev];
            });
            setSelectedReportId(createdReport.id);
            setFlyToLocation({ lat: createdReport.lat, lng: createdReport.lng });
          } else {
            loadReports();
          }
          setTrustScores((prev) => ({
            ...prev,
            citizen: Math.min(100, prev.citizen + 2),
          }));
          appendActionLog(
            'Citizen #C-042',
            `Citizen • Trust ${Math.min(100, trustScores.citizen + 2)}`,
            `Uploaded field evidence & generated SHA-256 Legal Receipt (${
              createdReport?.category || 'Civic Hazard'
            })`,
            createdReport?.locality || 'Greater Noida',
            '+2 Trust'
          );
          addToast(msg || 'Tamper-Proof Evidence Receipt generated!', 'success');
        }}
      />

      <PressKitModal
        clusterId={pressKitClusterId}
        allReports={reports}
        onClose={() => setPressKitClusterId(null)}
        onCopiedToast={() => addToast('Dossier copied to clipboard!', 'info')}
      />

      <PressDisputeModal
        report={disputeModalReport}
        journalistTrustScore={trustScores.journalist}
        openDisputesCount={openDisputesCount}
        onClose={() => setDisputeModalReport(null)}
        onConfirmDispute={handleConfirmDispute}
      />

      <BeforeAfterModal
        report={beforeAfterReport}
        workOrderId={beforeAfterReport ? workOrderIds[beforeAfterReport.id] : undefined}
        onClose={() => setBeforeAfterReport(null)}
      />

      <ResolutionUploadModal
        report={resolutionReport}
        onClose={() => setResolutionReport(null)}
        onError={(errMsg) => addToast(errMsg, 'error')}
        onResolved={(msg, updatedRep, workOrderId) => {
          setResolutionReport(null);
          if (updatedRep) {
            setDisputeRecords((prev) => {
              const next = { ...prev };
              delete next[updatedRep.id];
              return next;
            });
            if (workOrderId) {
              setWorkOrderIds((prev) => ({ ...prev, [updatedRep.id]: workOrderId }));
            }
            setReports((prev) =>
              prev.map((r) => (r.id === updatedRep.id ? updatedRep : r))
            );
            setTrustScores((prev) => ({
              ...prev,
              authority: Math.min(100, prev.authority + 4),
            }));
            appendActionLog(
              'GNIDA Zone-3',
              `Authority • Trust ${Math.min(100, trustScores.authority + 4)}`,
              `Published After-photo proof under Work-Order ${
                workOrderId || 'GNIDA/Z3/2026/WO-419'
              }`,
              updatedRep.locality,
              '+4 Trust'
            );
            setBeforeAfterReport(updatedRep);
          } else {
            loadReports();
          }
          addToast(
            msg || 'CASE FIXED & VERIFIED: Geo-verified After-photo published!',
            'success'
          );
        }}
      />

      <EvidenceLightboxModal
        report={lightboxReport}
        onClose={() => setLightboxReport(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
