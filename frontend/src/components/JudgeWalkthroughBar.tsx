import React from 'react';
import {
  Play,
  CheckCircle2,
  ChevronRight,
  X,
  Camera,
  ShieldCheck,
  Newspaper,
  Upload,
  Scale,
  Award,
} from 'lucide-react';

interface JudgeWalkthroughBarProps {
  isOpen: boolean;
  activeStep: number;
  onSelectStep: (step: number) => void;
  onClose: () => void;
}

const WALKTHROUGH_STEPS = [
  {
    step: 1,
    role: 'Citizen (#C-042)',
    title: '1. Citizen Report',
    desc: 'Sign in as Citizen #C-042 (Trust 88) & open + Report a Problem or +1 Confirm On-Site',
    icon: <Camera className="w-3.5 h-3.5" />,
  },
  {
    step: 2,
    role: 'Reviewer (Auditor)',
    title: '2. Reviewer Approve',
    desc: 'Auto-sort Needs Check to top & click Approve & Escalate or Merge into Hotspot',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  {
    step: 3,
    role: 'Journalist (#JD-204)',
    title: '3. Promote & RTI',
    desc: 'Promote Knowledge Park III 11kV Hotspot to Front-Page e-Paper & instant 0ms RTI Dossier',
    icon: <Newspaper className="w-3.5 h-3.5" />,
  },
  {
    step: 4,
    role: 'Authority (Zone-3)',
    title: '4. Upload After-Photo',
    desc: 'Open Authority Remediation Modal with Work-Order ID & load /evidence/*_after.jpg',
    icon: <Upload className="w-3.5 h-3.5" />,
  },
  {
    step: 5,
    role: 'Press vs. Authority',
    title: '5. Press Dispute & Reply',
    desc: 'Stake Trust (-10/+15) with counter-photo, post Authority Right of Reply & Reviewer Ruling',
    icon: <Scale className="w-3.5 h-3.5" />,
  },
  {
    step: 6,
    role: 'Before/After & Trust',
    title: '6. Slider & Leaderboard',
    desc: 'Inspect Before/After Split Slider & view 4-Role Trust Leaderboard in Area Scorecard',
    icon: <Award className="w-3.5 h-3.5" />,
  },
];

export const JudgeWalkthroughBar: React.FC<JudgeWalkthroughBarProps> = ({
  isOpen,
  activeStep,
  onSelectStep,
  onClose,
}) => {
  if (!isOpen) return null;

  const currentObj =
    WALKTHROUGH_STEPS.find((s) => s.step === activeStep) || WALKTHROUGH_STEPS[0];

  return (
    <div className="bg-gradient-to-r from-[#0B1120] via-slate-900 to-[#0B1120] text-white border-b border-emerald-500/40 px-4 lg:px-6 py-2.5 shrink-0 z-20 shadow-lg">
      <div className="w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left Title & Current Step Hint */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center gap-1 shadow-xs">
            <Play className="w-3 h-3 fill-current" />
            <span>Judge Walkthrough (6-Step Guided Demo)</span>
          </span>
          <span className="text-xs text-emerald-300 font-bold">
            {currentObj.title}:{' '}
            <span className="text-slate-300 font-normal">{currentObj.desc}</span>
          </span>
        </div>

        {/* 6 Interactive Step Pills + Next Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {WALKTHROUGH_STEPS.map((st) => {
            const isCurrent = st.step === activeStep;
            const isDone = st.step < activeStep;
            return (
              <button
                key={st.step}
                onClick={() => onSelectStep(st.step)}
                className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                    : isDone
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  st.icon
                )}
                <span>{st.title}</span>
              </button>
            );
          })}

          <button
            onClick={() => onSelectStep(activeStep < 6 ? activeStep + 1 : 1)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 ml-1 shadow-xs"
          >
            <span>{activeStep < 6 ? 'Next Step' : 'Restart'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1"
            title="Hide Judge Walkthrough Bar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
