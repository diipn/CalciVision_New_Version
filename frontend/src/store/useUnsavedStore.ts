import { create } from 'zustand'

export const useUnsavedStore = create((set) => ({
    hasUnsavedChanges: false,
    setUnsavedChanges: (value: Boolean) => set({ hasUnsavedChanges: value }),
}))