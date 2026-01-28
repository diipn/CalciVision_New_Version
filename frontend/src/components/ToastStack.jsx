import React from "react";

const toastStyles = {
  success: "border-green-200 bg-green-50 text-green-900",
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-orange-200 bg-orange-50 text-orange-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-[260px] rounded-md border px-4 py-3 text-sm shadow-lg ${
            toastStyles[toast.type || "info"]
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              className="text-xs font-semibold"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fechar notificação"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
