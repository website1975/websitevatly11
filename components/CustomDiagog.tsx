import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface ToastState {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<{
  state: ConfirmState;
  onClose: () => void;
}> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  const isDanger = state.type === 'danger' || !state.type;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-5 border border-slate-100 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isDanger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm sm:text-base">{state.title || 'Xác nhận'}</h3>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Hành động này cần xác nhận</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium whitespace-pre-line">
          {state.message}
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (state.onCancel) state.onCancel();
              onClose();
            }}
            className="flex-1 py-3 text-[11px] font-bold uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl tracking-widest transition-all"
          >
            {state.cancelText || 'Hủy'}
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-white rounded-2xl font-black uppercase text-[11px] shadow-lg tracking-widest transition-all ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {state.confirmText || 'Đồng ý / Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ToastNotification: React.FC<{
  state: ToastState;
  onClose: () => void;
}> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  const isSuccess = state.type === 'success';
  const isError = state.type === 'error';
  const isWarning = state.type === 'warning';

  return (
    <div className="fixed top-5 right-5 z-[1000] max-w-md w-full animate-in slide-in-from-top-5 duration-300 p-2">
      <div
        className={`p-5 rounded-3xl shadow-2xl border flex items-start gap-4 ${
          isSuccess
            ? 'bg-emerald-900/95 text-white border-emerald-700/50 shadow-emerald-950/20'
            : isError
            ? 'bg-rose-900/95 text-white border-rose-700/50 shadow-rose-950/20'
            : isWarning
            ? 'bg-amber-900/95 text-white border-amber-700/50 shadow-amber-950/20'
            : 'bg-slate-900/95 text-white border-slate-700/50 shadow-slate-950/20'
        } backdrop-blur-xl`}
      >
        <div className="p-2 rounded-2xl bg-white/10 shrink-0">
          {isSuccess ? (
            <CheckCircle2 size={22} className="text-emerald-400" />
          ) : isError ? (
            <XCircle size={22} className="text-rose-400" />
          ) : isWarning ? (
            <AlertTriangle size={22} className="text-amber-400" />
          ) : (
            <Info size={22} className="text-sky-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          {state.title && (
            <h4 className="font-black text-xs uppercase tracking-wider text-white/90 mb-1">
              {state.title}
            </h4>
          )}
          <p className="text-xs font-medium text-white/80 leading-relaxed whitespace-pre-line break-words">
            {state.message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
