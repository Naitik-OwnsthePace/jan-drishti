import React from 'react';
import type { AppSection, DemoPresetId, UserRole } from '../types';
import { DEMO_ACCOUNTS } from './LoginModal';
import {
  PlusCircle,
  Eye,
  Home,
  Map,
  Newspaper,
  Award,
  ShieldCheck,
  LogIn,
  RotateCcw,
  Play,
} from 'lucide-react';

interface NavbarProps {
  activeSection: AppSection;
  activePreset: DemoPresetId | null;
  currentRole: UserRole;
  trustScores: Record<UserRole, number>;
  showWalkthrough: boolean;
  onToggleWalkthrough: () => void;
  onSectionChange: (section: AppSection) => void;
  onOpenReportModal: () => void;
  onOpenLoginModal: () => void;
  onResetDemoData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  activePreset,
  currentRole,
  trustScores,
  showWalkthrough,
  onToggleWalkthrough,
  onSectionChange,
  onOpenReportModal,
  onOpenLoginModal,
  onResetDemoData,
}) => {
  const navItems: { id: AppSection; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'map', label: 'Live Command Map', icon: <Map className="w-4 h-4" /> },
    { id: 'epaper', label: 'Jan Drishti e-Paper', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'scorecard', label: 'Area Scorecard', icon: <Award className="w-4 h-4" /> },
    { id: 'verify', label: 'Verify & About', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const activeAccount = activePreset ? DEMO_ACCOUNTS[activePreset] : null;
  const activeRoleScore = activePreset
    ? activePreset === 'admin'
      ? trustScores[currentRole]
      : trustScores[activeAccount!.role]
    : null;

  return (
    <header className="bg-[#0B1120] border-b border-slate-800/90 text-white px-3 lg:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none z-30 shadow-md">
      {/* Brand Emblem */}
      <div
        onClick={() => onSectionChange('home')}
        className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-rose-600 p-0.5 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
          <div className="w-full h-full bg-[#0B1120] rounded-[6px] flex items-center justify-center">
            <Eye className="w-4 h-4 text-amber-400 stroke-[2.5]" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-base tracking-tight text-white whitespace-nowrap">
              Jan Drishti
            </span>
            <span className="text-[11px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-extrabold uppercase whitespace-nowrap">
              Truth Engine
            </span>
          </div>
        </div>
      </div>

      {/* 5 Top-Level Navigation Tabs */}
      <nav className="flex items-center gap-0.5 bg-slate-900/95 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full min-w-0">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Action Bar: Judge Walkthrough Toggle + Demo Login / Trust Badge + Reset + Report CTA */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onToggleWalkthrough}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all whitespace-nowrap ${
            showWalkthrough
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
          }`}
          title="Toggle 6-Step Guided Judge Walkthrough Bar"
        >
          <Play className="w-3 h-3 fill-current shrink-0" />
          <span>Judge Walkthrough</span>
        </button>

        {activePreset === 'admin' && (
          <button
            type="button"
            onClick={onResetDemoData}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-extrabold transition-all shadow-sm whitespace-nowrap"
            title="Reset all reports & trust scores to fresh demo state"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden 2xl:inline">Reset</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLoginModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all whitespace-nowrap ${
            activeAccount
              ? 'bg-slate-900 hover:bg-slate-800 text-white border-amber-500/50'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-sm'
          }`}
        >
          <LogIn className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {activeAccount ? (
            <div className="flex items-center gap-1.5">
              <span>{activeAccount.title}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-black">
                {activeRoleScore}/100
              </span>
            </div>
          ) : (
            <span>Demo Login</span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenReportModal}
          className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300/50 transition-all whitespace-nowrap"
        >
          <PlusCircle className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
          <span>+ Report a Problem</span>
        </button>
      </div>
    </header>
  );
};
