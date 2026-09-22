import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
            toast.type === 'success'
              ? 'bg-stone-900 text-white border-stone-800'
              : toast.type === 'warning'
              ? 'bg-amber-950 text-amber-100 border-amber-800'
              : 'bg-white text-stone-900 border-stone-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <h5 className="font-semibold text-xs leading-tight">{toast.title}</h5>
            <p className={`text-[11px] mt-0.5 leading-normal ${toast.type === 'success' ? 'text-stone-300' : toast.type === 'warning' ? 'text-amber-200' : 'text-stone-600'}`}>
              {toast.message}
            </p>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-stone-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
