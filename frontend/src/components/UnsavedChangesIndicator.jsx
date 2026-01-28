import React from "react";
import { useUnsavedStore } from "../store/useUnsavedStore";

export default function UnsavedChangesIndicator({ className = "" }) {
  const { hasUnsavedChanges } = useUnsavedStore();

  if (!hasUnsavedChanges) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800 ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
      Alterações por guardar
    </span>
  );
}
