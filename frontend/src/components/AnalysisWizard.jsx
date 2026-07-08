import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClinicalReport,
  getExamSettings,
  quantifyObjectiveVariable,
  submitExamAnalysis,
  upsertClinicalReport,
  updateExamSettings,
} from "../api";
import { useUnsavedStore } from "../store/useUnsavedStore";
import ModeSelector from "./ModeSelector";
import ImageToolsPanel from "./ImageToolsPanel";
import ValveAnnotationStep from "./ValveAnnotationStep";
import CalcificationAssessmentStep from "./CalcificationAssessmentStep";
import ReportPreparationStep from "./ReportPreparationStep";
import ToastStack from "./ToastStack";
import { computeAutoImageSettings } from "../utils/autoImageEnhance";
import {
  readStoredClinicalReportDraft,
  clearStoredClinicalReportDraft,
  writeStoredClinicalReportDraft,
} from "../utils/clinicalReportDraft";

const VO_THRESHOLD = 30;

const steps = [
  {
    id: 1,
    title: "Anotar válvula",
    objective: "Delimite a válvula e confirme a anotação.",
  },
  {
    id: 2,
    title: "Avaliar calcificação",
    objective: "Revise a VO, selecione a classificação e valide.",
  },
  {
    id: 3,
    title: "Relatório clínico",
    objective: "Adiciona observações clínicas e gera o relatório.",
  },
];

const normalizeVo = (value) => {
  if (value === null || value === undefined) return null;
  return value > 1 ? value : value * 100;
};

const buildReportErrorMessage = (error, fallbackMessage) => {
  const backendError = error?.response?.data?.error;
  const backendIssues = error?.response?.data?.issues;

  return [
    backendError || fallbackMessage,
    Array.isArray(backendIssues) && backendIssues.length > 0 ? backendIssues.join(" ") : null,
  ]
    .filter(Boolean)
    .join(" ");
};

const hasAnnotatedFrameResults = (results = []) =>
  results.some((frame) => Array.isArray(frame?.rects) && frame.rects.length > 0);

export default function AnalysisWizard({
  renderCanvas,
  renderCanvasFooter,
  annotationToolRef,
  frames,
  currentFrame = 0,
  currentFrameSrc,
  rects,
  calcification,
  calcificationStatus,
  setCalcificationStatus,
  patient,
  exam,
  echoId,
  imageSettings,
  onImageSettingsChange,
  defaultImageSettings,
  comparisonCandidates = [],
  activeExamId,
  selectedExamId,
  onActiveExamChange,
  onSelectCurrentExam,
}) {
  const navigate = useNavigate();
  const { setUnsavedChanges } = useUnsavedStore();

  const [mode, setMode] = useState("ia");
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({});
  const [classificationChoice, setClassificationChoice] = useState(null);
  const [isValidated, setIsValidated] = useState(false);
  const [reportDraft, setReportDraft] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [validatedSummary, setValidatedSummary] = useState("");
  const [clinicalConclusion, setClinicalConclusion] = useState("");
  const [voOverrideEnabled, setVoOverrideEnabled] = useState(false);
  const [voOverrideValue, setVoOverrideValue] = useState(null);
  const [voManualUiEnabled, setVoManualUiEnabled] = useState(false);
  const [annotationStatusMessage, setAnnotationStatusMessage] = useState("");
  const [manualActionActive, setManualActionActive] = useState(false);
  const [aiActionActive, setAiActionActive] = useState(false);
  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(false);
  const [autoEnhanceLoading, setAutoEnhanceLoading] = useState(false);
  const [classificationTouched, setClassificationTouched] = useState(false);
  const [toasts, setToasts] = useState([]);

  const annotationRevision = useRef(0);
  const confirmedAnnotationRevision = useRef(0);
  const assessmentRevision = useRef(0);
  const confirmedAssessmentRevision = useRef(0);
  const settingsLoaded = useRef(false);
  const isHydrating = useRef(true);
  const progressHydrated = useRef(false);

  const voBase = useMemo(() => normalizeVo(exam?.vo), [exam?.vo]);
  const voEffective = voOverrideEnabled ? voOverrideValue : voBase;
  const voSuggestion =
    voEffective !== null
      ? voEffective > VO_THRESHOLD
        ? "Calcificada"
        : "Não calcificada"
      : null;

  const isAnnotationReady = rects.some((frameRects) => frameRects?.length > 0);
  const annotatedFramesCount = rects.filter((frameRects) => frameRects?.length > 0).length;
  const isComparisonMode = comparisonCandidates.length > 1;
  const activeCandidate = comparisonCandidates.find((candidate) => candidate.id === activeExamId);
  const selectedCandidate = comparisonCandidates.find((candidate) => candidate.id === selectedExamId);

  const addToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const isDev = import.meta.env.DEV;
  const logDebug = (label, data) => {
    if (isDev) {
      console.log(`[AnalysisWizard] ${label}`, data);
    }
  };

  useEffect(() => {
    setMode("ia");
    setCurrentStep(1);
    setCompletedSteps({});
    setClassificationChoice(null);
    setIsValidated(false);
    setReportDraft(null);
    setReportError("");
    setReportLoading(false);
    setClinicalNotes("");
    setValidatedSummary("");
    setClinicalConclusion("");
    setVoOverrideEnabled(false);
    setVoOverrideValue(null);
    setVoManualUiEnabled(false);
    setAnnotationStatusMessage("");
    setManualActionActive(false);
    setAiActionActive(false);
    setAutoEnhanceEnabled(false);
    setAutoEnhanceLoading(false);
    setClassificationTouched(false);
    setToasts([]);

    annotationRevision.current = 0;
    confirmedAnnotationRevision.current = 0;
    assessmentRevision.current = 0;
    confirmedAssessmentRevision.current = 0;
    settingsLoaded.current = false;
    isHydrating.current = true;
    progressHydrated.current = false;
  }, [echoId]);

  useEffect(() => {
    const hydrateSettings = async () => {
      if (!echoId) return;
      const settings = await getExamSettings(echoId);
      if (settings) {
        setClassificationChoice(
          settings.classificationOverride !== undefined
            ? settings.classificationOverride
            : null
        );
        if (settings.classificationOverride !== undefined) {
          setClassificationTouched(true);
        }
        setIsValidated(Boolean(settings.validated));
        setClinicalNotes(settings.clinicalNotes || "");
        setValidatedSummary(settings.validatedSummary || "");
        setClinicalConclusion(settings.clinicalConclusion || "");
        setVoOverrideEnabled(Boolean(settings.voOverrideEnabled));
        if (settings.voOverrideValue !== undefined && settings.voOverrideValue !== null) {
          setVoOverrideValue(Number(settings.voOverrideValue));
        }
      }
      settingsLoaded.current = true;
    };
    hydrateSettings();
  }, [echoId]);

  useEffect(() => {
    const hydrateReport = async () => {
      if (!patient?.id || !echoId) return;
      try {
        setReportLoading(true);
        const report = await getClinicalReport(patient.id, echoId);
        if (!report) {
          const storedDraft = readStoredClinicalReportDraft(patient.id, echoId);
          setReportDraft(storedDraft);
          if (storedDraft) {
            setValidatedSummary(storedDraft.validated_summary || "");
            setClinicalNotes(storedDraft.clinical_notes || "");
            setClinicalConclusion(storedDraft.clinical_conclusion || "");
          }
          return;
        }

        setReportDraft(report);
        setReportError("");
        setValidatedSummary(report.validated_summary || "");
        setClinicalNotes(report.clinical_notes || "");
        setClinicalConclusion(report.clinical_conclusion || "");
        writeStoredClinicalReportDraft(patient.id, echoId, report);
        setCompletedSteps((prev) => ({
          ...prev,
          3: true,
        }));
      } catch (error) {
        console.error("Erro ao carregar o relatório clínico:", error);
        setReportError(
          buildReportErrorMessage(
            error,
            "Não foi possível carregar o relatório persistido deste exame."
          )
        );
      } finally {
        setReportLoading(false);
      }
    };

    hydrateReport();
  }, [patient?.id, echoId]);

  useEffect(() => {
    if (!echoId) return;
    progressHydrated.current = true;
    const saved = localStorage.getItem(`exam-progress-${echoId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.step) {
        setCurrentStep(parsed.step);
        setCompletedSteps((prev) => {
          const next = {
            ...prev,
            1: parsed.step >= 2,
            2: parsed.step >= 3,
          };

          if (prev[1] === next[1] && prev[2] === next[2]) {
            return prev;
          }

          return next;
        });
      }
    } catch (error) {
      console.warn("Não foi possível carregar o progresso guardado.", error);
    }
  }, [echoId]);

  useEffect(() => {
    if (!progressHydrated.current) return;
    setCompletedSteps((prev) => {
      const nextStep2 = isValidated || prev[2];
      const nextStep3 = Boolean(reportDraft);

      if (prev[2] === nextStep2 && prev[3] === nextStep3) {
        return prev;
      }

      return {
        ...prev,
        2: nextStep2,
        3: nextStep3,
      };
    });
  }, [isValidated, reportDraft]);

  useEffect(() => {
    if (!echoId) return;
    const payload = {
      step: currentStep,
      rects,
      calcification,
      hasReportDraft: Boolean(reportDraft),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`exam-progress-${echoId}`, JSON.stringify(payload));
  }, [echoId, currentStep, rects, calcification, reportDraft]);

  useEffect(() => {
    if (voBase !== null && !voOverrideEnabled && voOverrideValue === null) {
      setVoOverrideValue(Math.round(voBase));
    }
  }, [voBase, voOverrideEnabled, voOverrideValue]);


  useEffect(() => {
    if (classificationChoice !== null && classificationChoice !== calcificationStatus) {
      setCalcificationStatus(classificationChoice);
    }
  }, [classificationChoice, calcificationStatus, setCalcificationStatus]);

  const handleAnnotationChanged = () => {
    annotationRevision.current += 1;
    if (currentStep === 1 && mode === "manual") {
      setAnnotationStatusMessage("Anotação manual concluída.");
    }
    if (mode === "manual") {
      setManualActionActive(false);
    }
    if (completedSteps[2] || completedSteps[3]) {
      setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false }));
      if (currentStep > 2) setCurrentStep(2);
      setClassificationChoice(null);
      setClassificationTouched(false);
      setReportDraft(null);
      clearStoredClinicalReportDraft(patient?.id, echoId);
      setReportError("A análise foi alterada. Gere novamente o relatório antes de o validar ou exportar.");
      addToast("Alteração detetada. É necessário rever a avaliação clínica.", "warning");
    }
  };

  useEffect(() => {
    if (!settingsLoaded.current) return;
    if (isHydrating.current) {
      isHydrating.current = false;
      return;
    }
    if (!isValidated) return;
    assessmentRevision.current += 1;
    if (assessmentRevision.current > confirmedAssessmentRevision.current) {
      setIsValidated(false);
      setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false }));
      setReportDraft(null);
      clearStoredClinicalReportDraft(patient?.id, echoId);
      setReportError("A avaliação clínica mudou. Gere novamente o relatório para refletir a decisão final.");
      updateExamSettings(echoId, { validated: false });
      addToast("Alteração detetada. Revalide a avaliação clínica.", "warning");
    }
  }, [classificationChoice, voOverrideEnabled, voOverrideValue]);

  useEffect(() => {
    if (!classificationTouched && voSuggestion) {
      setClassificationChoice(voSuggestion === "Calcificada");
    }
  }, [voSuggestion, classificationTouched]);

  useEffect(() => {
    if (!isComparisonMode) return;
    if (selectedExamId === activeExamId) return;

    setCurrentStep(1);
    setCompletedSteps({});
    setIsValidated(false);
    setReportDraft(null);
    clearStoredClinicalReportDraft(patient?.id, echoId);
    setReportError("");
  }, [isComparisonMode, selectedExamId, activeExamId]);

  const handleModeChange = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setAnnotationStatusMessage("");
    setUnsavedChanges(true);
    setManualActionActive(false);
    setAiActionActive(false);
    setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false }));
    setReportDraft(null);
    clearStoredClinicalReportDraft(patient?.id, echoId);
    setReportError("O modo de anotação foi alterado. Gere um novo relatório após rever a análise.");
    setCurrentStep(1);
    addToast("Modo alterado. Reveja a anotação da válvula.", "info");
  };

  const handleConfirmAnnotation = () => {
    if (!isAnnotationReady) {
      addToast("Conclua a anotação antes de confirmar.", "error");
      return;
    }
    onSelectCurrentExam?.();
    confirmedAnnotationRevision.current = annotationRevision.current;
    setCompletedSteps((prev) => ({ ...prev, 1: true }));
    setCurrentStep(2);
    addToast("Anotação confirmada.", "success");
  };

  const handleAutoEnhanceApply = async () => {
    if (!currentFrameSrc) {
      addToast("Selecione um frame válido antes de otimizar a imagem.", "error");
      return;
    }

    try {
      setAutoEnhanceLoading(true);
      const optimizedSettings = await computeAutoImageSettings(currentFrameSrc, imageSettings);

      setAutoEnhanceEnabled(true);
      onImageSettingsChange({
        ...imageSettings,
        brightness: optimizedSettings.brightness,
        contrast: optimizedSettings.contrast,
        blur: optimizedSettings.blur,
        zoom: imageSettings?.zoom ?? defaultImageSettings.zoom,
      });
      addToast("Otimização automática aplicada ao frame atual.", "success");
    } catch (error) {
      console.error("Erro ao otimizar automaticamente a imagem:", error);
      addToast("Não foi possível otimizar automaticamente a imagem.", "error");
    } finally {
      setAutoEnhanceLoading(false);
    }
  };

  const handleValidateAssessment = async () => {
    if (classificationChoice === null) {
      addToast("Selecione a classificação final.", "error");
      return;
    }
    await updateExamSettings(echoId, {
      classificationOverride: classificationChoice,
      validated: true,
      voOverrideEnabled,
      voOverrideValue,
    });
    confirmedAssessmentRevision.current = assessmentRevision.current;
    setIsValidated(true);
    setCompletedSteps((prev) => ({ ...prev, 2: true }));
    setCurrentStep(3);
    addToast("Avaliação clínica validada.", "success");
  };

  const handleEditValidation = async () => {
    await updateExamSettings(echoId, { validated: false });
    setIsValidated(false);
    addToast("Avaliação desbloqueada para edição.", "info");
  };

  const persistReport = async (markReady = false) => {
    if (!patient?.id || !echoId) {
      throw new Error("Não existe contexto suficiente para guardar o relatório.");
    }

    const results = buildFrameResults();
    if (!hasAnnotatedFrameResults(results)) {
      throw new Error("Defina pelo menos uma ROI válida antes de gerar o relatório.");
    }

    setReportLoading(true);
    setReportError("");

    try {
      await submitExamAnalysis(patient.id, echoId, {
        results,
        completed: false,
        echoName: exam?.description || undefined,
      });

      const response = await upsertClinicalReport(patient.id, echoId, {
        results,
        classification_choice: classificationChoice,
        validated_summary: validatedSummary,
        clinical_notes: clinicalNotes,
        clinical_conclusion: clinicalConclusion,
        mark_ready: markReady,
      });

      setReportDraft(response);
      setValidatedSummary(response.validated_summary || "");
      setClinicalNotes(response.clinical_notes || "");
      setClinicalConclusion(response.clinical_conclusion || "");
      setCompletedSteps((prev) => ({ ...prev, 3: true }));
      writeStoredClinicalReportDraft(patient.id, echoId, response);

      await updateExamSettings(echoId, {
        clinicalNotes: response.clinical_notes || "",
        validatedSummary: response.validated_summary || "",
        clinicalConclusion: response.clinical_conclusion || "",
      });

      return response;
    } catch (error) {
      const backendReport = error?.response?.data?.report;

      if (backendReport) {
        setReportDraft(backendReport);
        writeStoredClinicalReportDraft(patient.id, echoId, backendReport);
      }

      const message = buildReportErrorMessage(
        error,
        "Não foi possível guardar o relatório clínico."
      );

      setReportError(message);
      throw new Error(message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setUnsavedChanges(true);
    try {
      await persistReport(false);
      setUnsavedChanges(false);
      navigate(`/patients/${patient.id}/reports/${echoId}`);
    } catch (error) {
      console.error("Erro ao gerar o relatório:", error);
      addToast(error.message || "Não foi possível gerar o relatório.", "error");
    }
  };

  const handleNotesChange = async (value) => {
    setClinicalNotes(value);
    setUnsavedChanges(true);
    await updateExamSettings(echoId, { clinicalNotes: value });
  };

  const buildFrameResults = () =>
    frames.map((frame, frameIndex) => {
      const frameRects = Array.isArray(rects?.[frameIndex]) ? rects[frameIndex] : [];
      const cleanedRects = frameRects
        .map((rect, rectIndex) => ({
          id: String(rect?.id ?? `${frame.id}-${rectIndex}`),
          x: Number(rect?.x),
          y: Number(rect?.y),
          width: Number(rect?.width),
          height: Number(rect?.height),
          is_annotation_generated: Boolean(rect?.is_annotation_generated),
        }))
        .filter(
          (rect) =>
            Number.isFinite(rect.x) &&
            Number.isFinite(rect.y) &&
            Number.isFinite(rect.width) &&
            Number.isFinite(rect.height)
        );

      const frameCalc = calcification?.[frameIndex];
      const calcValue = frameCalc?.binary_classification;
      const isCalcified =
        calcValue === null || calcValue === undefined
          ? typeof calcificationStatus === "boolean"
            ? calcificationStatus
            : null
          : Boolean(calcValue);
      const generatedCalcium =
        typeof frameCalc?.is_calcification_generated === "boolean"
          ? frameCalc.is_calcification_generated
          : null;

      return {
        frame_id: frame.id,
        rects: cleanedRects,
        is_calcified: isCalcified,
        generated_calcium: generatedCalcium,
      };
    });

  const handleAutoQuantifyVO = async () => {
    if (isValidated || !patient?.id) return;

    const results = buildFrameResults();
    const annotatedFrames = results.filter((frame) => frame.rects.length > 0);

    if (annotatedFrames.length === 0) {
      addToast("Defina pelo menos uma ROI da válvula antes de quantificar a VO.", "error");
      return;
    }

    try {
      const response = await quantifyObjectiveVariable(patient.id, echoId, results);
      const quantifiedValue = Number(response?.vo_percentage);

      if (!Number.isFinite(quantifiedValue)) {
        throw new Error("VO inválida recebida da API.");
      }

      const roundedValue = Math.round(quantifiedValue);

      setVoOverrideEnabled(true);
      setVoOverrideValue(roundedValue);
      setVoManualUiEnabled(false);
      setUnsavedChanges(true);

      addToast(`VO quantificada automaticamente: ${roundedValue}/100`, "success");

      await updateExamSettings(echoId, {
        voOverrideEnabled: true,
        voOverrideValue: roundedValue,
      });
    } catch (error) {
      console.error("Erro ao quantificar a VO:", error);
      addToast("Não foi possível quantificar automaticamente a VO.", "error");
    }
  };

  const stepTitle = steps.find((step) => step.id === currentStep)?.title;
  const stepObjective =
    currentStep === 1 && isComparisonMode
      ? "Compare os DICOMs carregados, teste a deteção da válvula e escolha o melhor exame."
      : steps.find((step) => step.id === currentStep)?.objective;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Análise da Válvula Aórtica
            </h1>
            <p className="text-sm text-gray-600">
              {stepObjective}
            </p>
          </div>
          <div className="rounded-full bg-green-50 px-4 py-1 text-sm font-semibold text-green-dark">
            Passo {currentStep} de {steps.length} — {stepTitle}
          </div>
        </div>
      </header>

      {currentStep > 1 && isComparisonMode && selectedCandidate && (
        <div className="rounded-lg border border-green-pale bg-green-50 px-4 py-3 text-sm text-green-900">
          <span className="font-semibold">Exame escolhido para continuar:</span>{" "}
          {selectedCandidate.label}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = Boolean(completedSteps[step.id]);
          const canNavigate = step.id <= currentStep || completedSteps[step.id - 1];
          return (
            <button
              key={step.id}
              type="button"
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-green-dark bg-green-dark text-white"
                  : isCompleted
                  ? "border-green-dark text-green-dark"
                  : "border-gray-200 text-gray-400"
              }`}
              onClick={() => canNavigate && setCurrentStep(step.id)}
              disabled={!canNavigate}
            >
              <span className="h-6 w-6 rounded-full border border-current text-center text-xs leading-6">
                {step.id}
              </span>
              {step.title}
            </button>
          );
        })}
      </div>

      {currentStep === 1 && isComparisonMode && (
        <section className="rounded-xl border border-green-pale bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Exames carregados para comparação
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                Navegue pelos DICOMs nesta mesma etapa, teste a deteção da válvula e
                escolha só um exame para continuar.
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedCandidate
                  ? "bg-green-50 text-green-900"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {selectedCandidate
                ? `Selecionado para avançar: ${selectedCandidate.label}`
                : "Ainda não existe um exame final selecionado"}
            </div>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {comparisonCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`w-[272px] shrink-0 rounded-xl border p-3 text-left transition ${
                  candidate.isActive
                    ? "border-green-dark bg-green-50/40 shadow-sm"
                    : "border-green-pale bg-white hover:border-green-dark/60"
                }`}
                onClick={() => onActiveExamChange?.(candidate.id)}
              >
                <div className="flex gap-3">
                  {candidate.thumbnailUrl ? (
                    <img
                      src={candidate.thumbnailUrl}
                      alt={candidate.label}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {candidate.isLoading ? "A carregar" : "Sem preview"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {candidate.orderLabel}
                      </span>
                      {candidate.isActive && (
                        <span className="rounded-full bg-green-dark px-2 py-0.5 text-[11px] font-semibold text-white">
                          Em foco
                        </span>
                      )}
                      {candidate.isSelected && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          Selecionado
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {candidate.label}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {candidate.isLoading
                        ? "A carregar frames..."
                        : candidate.loadError
                        ? "Erro ao carregar os frames deste exame."
                        : `${candidate.framesCount} frame(s)${
                            candidate.dateLabel ? ` · ${candidate.dateLabel}` : ""
                          }`}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          candidate.hasDetectionTested
                            ? "bg-green-50 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {candidate.hasDetectionTested
                          ? "Deteção IA testada"
                          : "Deteção por testar"}
                      </span>
                      {candidate.hasAnnotation && (
                        <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                          ROI definida
                        </span>
                      )}
                      {candidate.hasImageAdjustments && (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                          Imagem ajustada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStep !== 3 ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,340px)]">
          <div className="space-y-4">
            {renderCanvas ? renderCanvas(handleAnnotationChanged) : null}
            {currentStep === 1 && (
              <ImageToolsPanel
                imageSettings={imageSettings}
                onChange={(nextSettings) => {
                  setAutoEnhanceEnabled(false);
                  onImageSettingsChange(nextSettings);
                }}
                onReset={() => {
                  setAutoEnhanceEnabled(false);
                  onImageSettingsChange(defaultImageSettings);
                }}
                autoEnhanceEnabled={autoEnhanceEnabled}
                autoEnhanceLoading={autoEnhanceLoading}
                onAutoEnhanceApply={handleAutoEnhanceApply}
                variant="frame-dock"
              />
            )}
            {renderCanvasFooter ? renderCanvasFooter() : null}
          </div>
          <aside
            className={`rounded-lg border border-green-pale bg-white p-5 shadow-sm ${
              currentStep === 1 ? "lg:sticky lg:top-4" : ""
            }`}
          >
          {currentStep === 1 && (
            <div className="space-y-4">
              {activeCandidate && (
                <div className="rounded-lg border border-green-pale bg-green-light/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Exame em foco
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {activeCandidate.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {activeCandidate.dateLabel
                          ? `${activeCandidate.dateLabel} · ${frames.length} frame(s)`
                          : `${frames.length} frame(s)`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {frames.length > 0 && (
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-green-dark">
                          Frame {Math.min(currentFrame + 1, frames.length)}/{frames.length}
                        </span>
                      )}
                      {activeCandidate.isSelected && (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
                          Selecionado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        activeCandidate.hasDetectionTested
                          ? "bg-green-50 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {activeCandidate.hasDetectionTested
                        ? "Deteção IA testada"
                        : "Deteção por testar"}
                    </span>
                    {activeCandidate.hasAnnotation && (
                      <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                        ROI definida
                      </span>
                    )}
                    {activeCandidate.hasImageAdjustments && (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                        Imagem ajustada
                      </span>
                    )}
                  </div>

                  {isComparisonMode && selectedCandidate && selectedCandidate.id !== activeExamId && (
                    <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
                      O exame final continua a ser{" "}
                      <span className="font-semibold">{selectedCandidate.label}</span>. Confirme
                      o exame em foco se quiser trocar.
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-green-pale bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Modo de anotação
                  </h3>
                  <p className="mt-1 text-xs text-gray-600">
                    Os controlos abaixo adaptam-se ao modo escolhido para manter a área de
                    trabalho mais limpa.
                  </p>
                </div>
                <div className="mt-3">
                  <ModeSelector
                    mode={mode}
                    onChange={handleModeChange}
                    disabled={currentStep !== 1}
                    showDescription={false}
                  />
                </div>
                <div className="mt-4 border-t border-green-pale pt-4">
                  <ValveAnnotationStep
                    mode={mode}
                    isManualActive={manualActionActive}
                    isAiActive={aiActionActive}
                    annotationReady={isAnnotationReady}
                    annotatedFramesCount={annotatedFramesCount}
                    onManualDefine={() => {
                      annotationToolRef.current?.iniciarAnotacaoManual();
                      setManualActionActive(true);
                      setAiActionActive(false);
                      setAnnotationStatusMessage("Modo de desenho ativo.");
                    }}
                    onClearManual={() => {
                      annotationToolRef.current?.limparAnotacoes();
                      setManualActionActive(false);
                    }}
                    onDetectIA={async () => {
                      try {
                        const result = await annotationToolRef.current?.detetarValvulaIA();
                        if (result) {
                          setAnnotationStatusMessage("Válvula identificada.");
                          addToast("Válvula identificada.", "success");
                          setAiActionActive(true);
                          setManualActionActive(false);
                        } else {
                          addToast("Não foi possível detetar a válvula.", "error");
                        }
                      } catch (error) {
                        logDebug("Erro na deteção IA", error?.response?.data || error);
                        addToast("Erro ao detetar a válvula.", "error");
                      }
                    }}
                    onResetIA={() => {
                      annotationToolRef.current?.limparAnotacoes();
                      setAiActionActive(false);
                    }}
                  />
                </div>
                {annotationStatusMessage && (
                  <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
                    {annotationStatusMessage}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full rounded-md bg-green-dark px-5 py-2.5 text-[13px] font-semibold leading-none whitespace-nowrap text-white disabled:opacity-50"
                  onClick={handleConfirmAnnotation}
                  disabled={!isAnnotationReady}
                >
                  {isComparisonMode
                    ? "Escolher este exame e continuar"
                    : "Confirmar anotação"}
                </button>
                {!isAnnotationReady && (
                  <p className="text-xs text-gray-500">
                    Confirme a anotação depois de existir pelo menos uma ROI da válvula.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <CalcificationAssessmentStep
              voValue={voEffective !== null ? voEffective : null}
              voSuggestion={voSuggestion}
              voEditable={!isValidated}
              voOverrideValue={voOverrideValue}
              onToggleVoOverride={(checked) => {
                setVoManualUiEnabled(checked);
                // Se o user activar o manual, garantimos que está a usar override
                if (checked) {
                  setVoOverrideEnabled(true);
                }
                setUnsavedChanges(true);
              }}
              onVoOverrideChange={(value) => {
                const numeric = Number(value);
                if (Number.isNaN(numeric)) return;
                if (numeric < 0 || numeric > 100) {
                  addToast("Introduza um valor entre 0 e 100.", "error");
                  return;
                }
                setVoOverrideValue(numeric);
                setUnsavedChanges(true);
              }}
              isVoOverrideActive={voManualUiEnabled}
              classificationChoice={classificationChoice}
              onClassificationChange={(value) => {
                setClassificationChoice(value);
                setClassificationTouched(true);
                setUnsavedChanges(true);
              }}
              isValidated={isValidated}
              onValidate={handleValidateAssessment}
              onEditValidation={handleEditValidation}
              showManualBadge={voManualUiEnabled}
              onAutoQuantify={handleAutoQuantifyVO}
            />
          )}
          </aside>
        </div>
      ) : (
        <ReportPreparationStep
          report={reportDraft}
          reportLoading={reportLoading}
          reportError={reportError}
          clinicalNotes={clinicalNotes}
          onNotesChange={handleNotesChange}
          onGenerate={handleGenerateReport}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
