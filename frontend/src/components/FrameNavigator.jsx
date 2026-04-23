import React from "react";
import AnnotationToolSlider from "./AnnotationToolSlider";

export default function FrameNavigator({ frames, rects, currentFrame, setCurrentFrame, batchStatus }) {
  const totalFrames = frames.length;
  const canGoPrev = currentFrame > 0;
  const canGoNext = currentFrame < totalFrames - 1;

  if (totalFrames <= 1) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-green-pale bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-dark">
          {currentFrame + 1}/{totalFrames}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-green-pale px-3 py-1 text-sm text-green-dark disabled:opacity-40"
            onClick={() => setCurrentFrame(currentFrame - 1)}
            disabled={!canGoPrev}
          >
            Anterior
          </button>
          <button
            type="button"
            className="rounded-md border border-green-pale px-3 py-1 text-sm text-green-dark disabled:opacity-40"
            onClick={() => setCurrentFrame(currentFrame + 1)}
            disabled={!canGoNext}
          >
            Próximo
          </button>
        </div>
      </div>
      <div className="mt-3">
        <AnnotationToolSlider
          frames={frames}
          rects={rects}
          currentFrame={currentFrame}
          setCurrentFrame={setCurrentFrame}
          batchStatus={batchStatus}
        />
      </div>
    </div>
  );
}
