import React from 'react';
import type { Report, AppSection, PublicActionLogEntry, DemoPresetId } from '../types';
import { getAlignedCivicPhoto } from '../utils/civicPhotos';
import {
  Map,
  Newspaper,
  PlusCircle,
  ShieldCheck,
  Flame,
  Clock,
  CheckCircle2,
  Camera,
  Scale,
  SlidersHorizontal,
  ArrowRight,
  Award,
  FileCheck2,
  LogIn,
  Activity,
} from 'lucide-react';

interface HomeViewProps {
  reports: Report[];
  clusterCounts: Record<string, number>;
  actionLog: PublicActionLogEntry[];
  activePreset: DemoPresetId | null;
  onNavigate: (section: AppSection) => void;
  onOpenReportModal: () => void;
  onOpenLoginModal: () => void;
  onOpenPressKit: (clusterId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  reports,
  clusterCounts,
  actionLog,
  activePreset,
  onNavigate,
  onOpenReportModal,
  onOpenLoginModal,
  onOpenPressKit,
}) => {
  const totalReports = reports.length;
  const hotspots = Object.values(clusterCounts).filter((c) => c >= 2).length;
  const overdue = reports.filter((r) => r.status === 'SLA_BREACHED').length;
  const resolved = reports.filter((r) => r.status === 'RESOLVED').length;

  const leadReport =
    reports.find((r) => r.status === 'SLA_BREACHED') || reports[0];

  const workflowSteps = [
    {
      step: '01',
      role: 'Citizen Reporter (#C-042 • Trust 88/100)',
      title: 'Capture & Cryptographically Seal',
      desc: 'Upload a field photo. Jan Drishti extracts camera EXIF GPS coordinates and seals the raw image bytes with a tamper-proof SHA-256 fingerprint.',
      icon: <Camera className="w-5 h-5 text-amber-400" />,
    },
    {
      step: '02',
      role: 'Civic Reviewer (Auditor • Trust 92/100)',
      title: 'Geo-Forensic Audit & Dispute Arbitration',
      desc: 'Audits EXIF GPS offsets, merges 200m hotspots, and adjudicates Under Dispute Review challenges between Accredited Press and Authority.',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    },
    {
      step: '03',
      role: 'Investigative Journalist (#JD-204 • Trust 78/100)',
      title: 'e-Paper, RTI Notice & Staked Disputes',
      desc: 'Generates bilingual EN/हिन्दी press dossiers & RTI Act 2005 PDFs, or stakes Trust (-10/+15) with counter-photo evidence to challenge poor fixes.',
      icon: <Scale className="w-5 h-5 text-amber-400" />,
    },
    {
      step: '04',
      role: 'Municipal Authority (Zone-3 • Trust 81/100)',
      title: 'Before / After Proof & Right of Reply',
      desc: 'Officials cannot close a ticket without geo-verified After-photo proof and Work-Order ID, and can post an official Right of Reply on disputed cases.',
      icon: <SlidersHorizontal className="w-5 h-5 text-emerald-400" />,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9]">
      {/* Editorial Hero Banner */}
      <section className="bg-[#0B1120] text-white border-b border-slate-800 relative overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 py-10 lg:py-12 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Greater Noida Civic Accountability &amp; Truth Engine</span>
          </div>

          <h1 className="font-broadsheet text-2xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight text-white leading-[1.18] max-w-4xl mb-4">
            Turning Ignored Citizen Complaints into{' '}
            <span className="text-amber-400 underline decoration-amber-500/40 decoration-wavy underline-offset-8">
              Tamper-Proof Journalism.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed mb-7">
            Conventional grievance portals let authorities close tickets without proof.{' '}
            <strong className="text-white font-bold">Jan Drishti</strong> combines camera EXIF forensics, SHA-256 cryptographic hashing, spatial hotspot clustering, and Reviewer-arbitrated Trust Score staking so public hazards can never be swept under the rug.
          </p>

          {/* Quick-Launch Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('map')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Map className="w-4 h-4 stroke-[2.5]" />
              <span>Launch Live Command Map</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenLoginModal}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02]"
            >
              <LogIn className="w-4 h-4 text-amber-300" />
              <span>
                {activePreset
                  ? `Demo Login Active (${activePreset.toUpperCase()})`
                  : 'Demo Login (5 Role Presets)'}
              </span>
            </button>

            <button
              onClick={() => onNavigate('epaper')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02]"
            >
              <Newspaper className="w-4 h-4 text-amber-400" />
              <span>Read Jan Drishti e-Paper (EN / हिन्दी)</span>
            </button>

            <button
              onClick={onOpenReportModal}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-extrabold text-xs sm:text-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Report a Problem</span>
            </button>

            <button
              onClick={() => onNavigate('verify')}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs sm:text-sm transition-all"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>SHA-256 Photo Verifier</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* Live Citywide Impact Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigate('map')}
            className="cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all border-l-4 border-l-slate-900"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500 mb-1">
              <span>Verified Evidence</span>
              <ShieldCheck className="w-4 h-4 text-slate-800" />
            </div>
            <div className="text-3xl font-black text-slate-950 font-mono">{totalReports}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              SHA-256 sealed citizen submissions
            </div>
          </div>

          <div
            onClick={() => onNavigate('map')}
            className="cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all border-l-4 border-l-amber-500"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-amber-700 mb-1">
              <span>Citizen Hotspots</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-amber-900 font-mono">{hotspots}</div>
            <div className="text-xs text-amber-700 mt-1 font-medium">
              Multi-report 200m corroborated zones
            </div>
          </div>

          <div
            onClick={() => onNavigate('map')}
            className="cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all border-l-4 border-l-red-600"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-red-600 mb-1">
              <span>Overdue (Ignored)</span>
              <Clock className="w-4 h-4 text-red-600 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-red-700 font-mono">{overdue}</div>
            <div className="text-xs text-red-600 mt-1 font-medium">
              Breached municipal SLA deadline
            </div>
          </div>

          <div
            onClick={() => onNavigate('scorecard')}
            className="cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-600"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-emerald-700 mb-1">
              <span>Fixed &amp; Verified</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-800 font-mono">{resolved}</div>
            <div className="text-xs text-emerald-700 mt-1 font-medium">
              With Before &amp; After photo proof (4h–28h)
            </div>
          </div>
        </div>

        {/* 4-Step Visual Workflow Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                How the 4-Role Accountability &amp; Trust Engine Works
              </h2>
              <p className="text-xs text-slate-500">
                Every citizen complaint progresses through an auditable, RBAC-protected pipeline
              </p>
            </div>
            <button
              onClick={onOpenLoginModal}
              className="text-xs font-extrabold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              <span>Sign In via Demo Login to Test All 4 Roles</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflowSteps.map((wf) => (
              <div
                key={wf.step}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0B1120] text-amber-400 font-mono text-xs font-black">
                      STEP {wf.step}
                    </span>
                    <div className="p-2 rounded-xl bg-slate-900">{wf.icon}</div>
                  </div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                    {wf.role}
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-950 leading-snug">
                    {wf.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{wf.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: Featured Spotlight Investigation + Live Public Accountability Action Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Featured Spotlight Investigation Card */}
          {leadReport && (
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col sm:flex-row">
              <div className="sm:w-64 h-56 sm:h-auto bg-slate-900 relative shrink-0">
                <img
                  src={leadReport.image_url || getAlignedCivicPhoto(leadReport).beforeUrl}
                  alt={leadReport.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getAlignedCivicPhoto(leadReport).beforeUrl;
                  }}
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-black uppercase shadow">
                  Top Overdue Investigation
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-red-600 uppercase mb-1 flex-wrap">
                    <span>{leadReport.locality}</span>
                    <span>•</span>
                    <span>{leadReport.category}</span>
                    <span>•</span>
                    <span>Risk {leadReport.severity}/10</span>
                  </div>
                  <h3 className="font-broadsheet text-xl font-black text-slate-950 mb-2">
                    {leadReport.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {leadReport.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onOpenPressKit(leadReport.cluster_id || leadReport.id)}
                    className="px-3.5 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 text-amber-400 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Open Media &amp; RTI Dossier</span>
                  </button>
                  <button
                    onClick={() => onNavigate('epaper')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                  >
                    <Newspaper className="w-4 h-4" />
                    <span>Broadsheet e-Paper</span>
                  </button>
                  <button
                    onClick={() => onNavigate('scorecard')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                  >
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Scorecard &amp; Trust</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Right 5 Cols: Live Public Accountability Action Log */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Live Public Accountability Action Log
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                AUDIT LEDGER
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {actionLog.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900">
                      {entry.actor}{' '}
                      <span className="font-mono text-slate-500">({entry.roleLabel})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {entry.trustDelta && (
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-black text-xs ${
                            entry.trustDelta.startsWith('+')
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.trustDelta.startsWith('-')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {entry.trustDelta}
                        </span>
                      )}
                      <span className="font-mono text-slate-400">{entry.timestamp}</span>
                    </div>
                  </div>
                  <p className="text-slate-700 font-medium leading-snug">
                    {entry.action} — <strong className="text-slate-900">{entry.locality}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
