import { create } from 'zustand'

type BatchType = {
    task_id: string;
    echo_id: number;
}

export const useBatchProgressStore = create((set) => ({
    activeBatches: [], // [{ task_id, patient, echo, frame_id }]
    addBatch: (batch: BatchType) =>
        set((state) => ({
            activeBatches: [...state.activeBatches, batch]
        })),
    removeBatch: (task_id: string) =>
        set((state) => ({
            activeBatches: state.activeBatches.filter(batch => batch.task_id !== task_id)
        })),
    setBatches: (batches: BatchType[]) => set({ activeBatches: batches }),
    clearBatches: () => set({ activeBatches: [] }),
}))