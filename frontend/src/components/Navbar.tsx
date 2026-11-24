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
    <header className="bg-[#0B1120] border-b border-slate-800/90 text-white px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none z-30 shadow-xl">
      {/* Brand Emblem */}
      <div
        onClick={() => onSectionChange('home')}
        className="flex items-center gap-3 cursor-pointer group shrink-0"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-rose-600 p-0.5 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
          <div className="w-full h-full bg-[#0B1120] rounded-[10px] flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-400 stroke-[2.5]" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight text-white">Jan Drishti</span>
            <span className="text-xs font-mono tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-extrabold uppercase">
              Truth Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium hidden xl:block">
            Through the Eyes of the People • Civic Accountability
          </p>
        </div>
      </div>

      {/* 5 Top-Level Navigation Tabs */}
      <nav className="flex items-center bg-slate-900/95 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
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
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={onToggleWalkthrough}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
            showWalkthrough
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
          }`}
          title="Toggle 6-Step Guided Judge Walkthrough Bar"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Judge Walkthrough</span>
        </button>

        {activePreset === 'admin' && (
          <button
            onClick={onResetDemoData}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-extrabold transition-all shadow-sm"
            title="Reset all reports & trust scores to fresh demo state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset Demo Data</span>
          </button>
        )}

        <button
          onClick={onOpenLoginModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
            activeAccount
              ? 'bg-slate-900 hover:bg-slate-800 text-white border-amber-500/50'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-md'
          }`}
        >
          <LogIn className="w-3.5 h-3.5 text-amber-400" />
          {activeAccount ? (
            <div className="flex items-center gap-1.5">
              <span>{activeAccount.title}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-black">
                Trust {activeRoleScore}/100
              </span>
            </div>
          ) : (
            <span>Demo Login (Read-Only)</span>
          )}
        </button>

        <button
          onClick={onOpenReportModal}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 ring-1 ring-amber-300/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4 stroke-[2.5]" />
          <span>+ Report a Problem</span>
        </button>
      </div>
    </header>
  );
};
