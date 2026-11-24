import React from 'react';
import type { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let bg = 'bg-slate-900 border-slate-700 text-white';
        let icon = <Info className="w-4 h-4 text-indigo-400 shrink-0" />;

        if (toast.type === 'success') {
          bg = 'bg-emerald-950 border-emerald-800 text-emerald-100';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
        } else if (toast.type === 'warning') {
          bg = 'bg-amber-950 border-amber-800 text-amber-100';
          icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
        } else if (toast.type === 'error') {
          bg = 'bg-rose-950 border-rose-800 text-rose-100';
          icon = <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-up ${bg}`}
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              {icon}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
