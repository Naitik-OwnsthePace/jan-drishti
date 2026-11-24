import React from 'react';
import type { DemoAccount, DemoPresetId, UserRole } from '../types';
import {
  X,
  ShieldCheck,
  UserCheck,
  Scale,
  Building2,
  Crown,
  RotateCcw,
  LogOut,
  Lock,
  CheckCircle2,
} from 'lucide-react';

export const DEMO_ACCOUNTS: Record<DemoPresetId, DemoAccount> = {
  admin: {
    presetId: 'admin',
    role: 'verifier',
    isAdmin: true,
    title: 'Demo Admin (Super Demo)',
    credential: 'Judge Super-Admin • Full Pipeline Access',
    trustScore: 99,
    description:
      'Unlocks the full 4-role switching pill bar on Live Command Map plus 1-click Reset Demo Data.',
  },
  citizen: {
    presetId: 'citizen',
    role: 'citizen',
    isAdmin: false,
    title: 'Citizen',
    credential: 'Verified Citizen #C-042',
    trustScore: 88,
    description:
      'Can only submit + Report a Problem and click +1 Confirm On-Site to corroborate field hazards.',
  },
  verifier: {
    presetId: 'verifier',
    role: 'verifier',
    isAdmin: false,
    title: 'Reviewer',
    credential: 'Truth Engine Auditor',
    trustScore: 92,
    description:
      'Automatically sorts Needs Check cards to the top; can Approve & Escalate, Merge into Hotspot, Dismiss Fake, and adjudicate Under Dispute Review cases.',
  },
  journalist: {
    presetId: 'journalist',
    role: 'journalist',
    isAdmin: false,
    title: 'Journalist',
    credential: 'Accredited Press #JD-204',
    trustScore: 78,
    description:
      'Can Promote to Front Page, Generate RTI, and open evidence-backed disputes (capped at 3 active disputes, requires Trust ≥ 65).',
  },
  authority: {
    presetId: 'authority',
    role: 'authority',
    isAdmin: false,
    title: 'Authority',
    credential: 'GNIDA Official Zone-3',
    trustScore: 81,
    description:
      'Can upload After Photo Proof on verified tickets and post an official Right of Reply on disputed cases.',
  },
};

interface LoginModalProps {
  isOpen: boolean;
  activePreset: DemoPresetId | null;
  trustScores: Record<UserRole, number>;
  openDisputesCount: number;
  onClose: () => void;
  onSelectPreset: (presetId: DemoPresetId) => void;
  onLogout: () => void;
  onResetDemoData: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  activePreset,
  trustScores,
  openDisputesCount,
  onClose,
  onSelectPreset,
  onLogout,
  onResetDemoData,
}) => {
  if (!isOpen) return null;

  const presets: {
    id: DemoPresetId;
    icon: React.ReactNode;
    accent: string;
    score: number;
  }[] = [
    {
      id: 'admin',
      icon: <Crown className="w-5 h-5 text-amber-400" />,
      accent: 'border-amber-500/50 bg-amber-50/70',
      score: 99,
    },
    {
      id: 'citizen',
      icon: <UserCheck className="w-5 h-5 text-sky-600" />,
      accent: 'border-slate-200 bg-white',
      score: trustScores.citizen,
    },
    {
      id: 'verifier',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
      accent: 'border-slate-200 bg-white',
      score: trustScores.verifier,
    },
    {
      id: 'journalist',
      icon: <Scale className="w-5 h-5 text-rose-600" />,
      accent: 'border-slate-200 bg-white',
      score: trustScores.journalist,
    },
    {
      id: 'authority',
      icon: <Building2 className="w-5 h-5 text-emerald-600" />,
      accent: 'border-slate-200 bg-white',
      score: trustScores.authority,
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-scale-up"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B1120] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold">
                  Controlled Demo Login &amp; Role-Based Access Control (RBAC)
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold">
                  TRUST ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select an authenticated persona to test strict role permissions &amp; live Trust Score staking
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
          <div className="space-y-3">
            {presets.map((p) => {
              const acc = DEMO_ACCOUNTS[p.id];
              const isSelected = activePreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPreset(p.id);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/90 shadow-md ring-2 ring-amber-400/30'
                      : `${p.accent} hover:border-slate-400 hover:shadow-xs`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0B1120] text-white shrink-0 mt-0.5">
                      {p.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-950">
                          {acc.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 font-mono text-xs font-bold">
                          {acc.credential}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-extrabold">
                          Trust {p.score}/100
                        </span>
                        {p.id === 'journalist' && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono text-xs font-bold">
                            Active Disputes: {openDisputesCount}/3
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {acc.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isSelected ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Active Session</span>
                      </span>
                    ) : (
                      <span className="px-3.5 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 text-amber-400 text-xs font-black whitespace-nowrap">
                        Sign In →
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin Reset Demo Data & Read-Only Sign Out Bar */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onResetDemoData();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Demo Data (Restore 16 Seeded Reports &amp; Trust Scores)</span>
            </button>

            {activePreset && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-extrabold flex items-center gap-1.5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out (Switch to Read-Only Public Mode)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
