import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  createReport,
  getEchoResults,
  getExamSettings,
  quantifyObjectiveVariable,
  updateExamSettings,
} from "../api";
import { useUser } from "../contexts/UserContext";
import { useUnsavedStore } from "../store/useUnsavedStore";
import ReportPDF from "./ReportPDF";
import { pdf } from "@react-pdf/renderer";
import ModeSelector from "./ModeSelector";
import ImageToolsPanel from "./ImageToolsPanel";
import ValveAnnotationStep from "./ValveAnnotationStep";
import CalcificationAssessmentStep from "./CalcificationAssessmentStep";
import ClinicalReportStep from "./ClinicalReportStep";
import ToastStack from "./ToastStack";
import { computeAutoImageSettings } from "../utils/autoImageEnhance";

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
    objective: "Gere o relatório e finalize o processo.",
  },
];

const normalizeVo = (value) => {
  if (value === null || value === undefined) return null;
  return value > 1 ? value : value * 100;
};

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
  const { user } = useUser();
  const { setUnsavedChanges } = useUnsavedStore();

  const [mode, setMode] = useState("ia");
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({});
  const [classificationChoice, setClassificationChoice] = useState(null);
  const [isValidated, setIsValidated] = useState(false);
  const [reportText, setReportText] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
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
  const [reportCreated, setReportCreated] = useState(false);

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
  const canSubmit = completedSteps[1] && completedSteps[2] && isValidated;
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
    setReportText("");
    setClinicalNotes("");
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
    setReportCreated(false);

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
        setReportText(settings.reportText || "");
        setClinicalNotes(settings.clinicalNotes || "");
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
    setReportCreated(false);
  }, [echoId]);

  useEffect(() => {
    if (!echoId) return;
    const saved = localStorage.getItem(`exam-progress-${echoId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.step) {
        setCurrentStep(parsed.step);
      }
      if (parsed?.reportText) {
        setReportText(parsed.reportText);
      }
      if (parsed?.step || parsed?.reportText) {
        setCompletedSteps({
          1: parsed?.step >= 2,
          2: parsed?.step >= 3,
          3: Boolean(parsed?.reportText),
        });
        progressHydrated.current = true;
      }
    } catch (error) {
      console.warn("Não foi possível carregar o progresso guardado.", error);
    }
  }, [echoId]);

  useEffect(() => {
    if (!progressHydrated.current) return;
    setCompletedSteps((prev) => ({
      ...prev,
      2: isValidated || prev[2],
      3: reportText ? true : prev[3],
    }));
  }, [isValidated, reportText]);

  useEffect(() => {
    if (!echoId) return;
    const payload = {
      step: currentStep,
      rects,
      calcification,
      reportText,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`exam-progress-${echoId}`, JSON.stringify(payload));
  }, [echoId, currentStep, rects, calcification, reportText]);

  useEffect(() => {
    if (voBase !== null && !voOverrideEnabled && voOverrideValue === null) {
      setVoOverrideValue(Math.round(voBase));
    }
  }, [voBase, voOverrideEnabled, voOverrideValue]);


  useEffect(() => {
    if (classificationChoice !== null) {
      setCalcificationStatus(classificationChoice);
    }
  }, [classificationChoice, setCalcificationStatus]);

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
  }, [isComparisonMode, selectedExamId, activeExamId]);

  const handleModeChange = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setAnnotationStatusMessage("");
    setUnsavedChanges(true);
    setManualActionActive(false);
    setAiActionActive(false);
    setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false }));
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

  const handleGenerateReport = async () => {
    if (!patient || !exam) return;
    const classificationLabel =
      classificationChoice === null
        ? "Não definida"
        : classificationChoice
        ? "Calcificada"
        : "Não calcificada";
    const examDate = exam.date || exam.uploaded_at;
    const template = `RELATÓRIO CLÍNICO - CALCIVISION\n\nPaciente: ${patient.name}\nData do exame: ${
      examDate ? new Date(examDate).toLocaleDateString("pt-PT") : "N/A"
    }\nVariável Objectiva (VO): ${
      voEffective !== null ? `${voEffective.toFixed(0)}%` : "N/A"
    }\nClassificação: ${classificationLabel}\n\nObservações automáticas:\n- Comparação longitudinal recomendada para acompanhar a progressão.\n- Este resultado é uma simulação e não substitui a decisão clínica.\n\nObservações clínicas:\n${clinicalNotes || "—"}\n\nAssinatura: ${user?.first_name || "Médico"} ${user?.last_name || ""}`;
    setReportText(template);
    setUnsavedChanges(true);
    await updateExamSettings(echoId, { reportText: template });
    try {
      const pdfBlob = await generatePdfBlob(template);
      const formData = new FormData();
      formData.append("pdf_file", pdfBlob, `report_${patient.id}.pdf`);
      await createReport(formData, patient.id);
      setReportCreated(true);
      addToast("Relatório gerado com sucesso.", "success");
    } catch (error) {
      console.error("Erro ao gerar o relatório:", error);
      addToast("Não foi possível gerar o relatório. Verifique os dados e tente novamente.", "error");
    }
  };

  const handleNotesChange = async (value) => {
    setClinicalNotes(value);
    setUnsavedChanges(true);
    await updateExamSettings(echoId, { clinicalNotes: value });
  };

  const generatePdfBlob = async (reportOverride = reportText) => {
    const echoData = await getEchoResults(patient.id, echoId);
    const doc = (
      <ReportPDF
        data={echoData}
        patient={patient}
        medico={user}
        reportText={reportOverride}
      />
    );
    const asPdf = pdf([]);
    asPdf.updateContainer(doc);
    return asPdf.toBlob();
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

  const handleExportPdf = async () => {
    if (!reportText) return;
    const pdfBlob = await generatePdfBlob();
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    const patientSlug =
      patient?.name?.trim()?.replace(/\s+/g, "_").toLowerCase() || `patient_${patient?.id || "report"}`;
    link.href = url;
    link.download = `relatorio_${patientSlug}_${echoId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleUpdateEcho = async () => {
    try {
      if (!patient) return;
      const results = buildFrameResults();

      await updateExamSettings(echoId, {
        classificationOverride: classificationChoice,
        validated: isValidated,
        reportText,
        clinicalNotes,
        voOverrideEnabled,
        voOverrideValue,
      });

      await createReportIfNeeded(true);

      const payload = {
        results,
        completed: true,
      };
      const echoName = exam?.description?.trim();
      if (echoName) {
        payload.echoName = echoName;
      }

      const endpoint = `/api/patient/${patient.id}/echocardiogram/${echoId}/submit/`;
      logDebug("Endpoint de submissão", endpoint);
      logDebug("Payload de submissão", payload);

      await api.post(endpoint, payload);

      setUnsavedChanges(false);
      addToast("Resultados submetidos com sucesso.", "success");
      navigate(`/patients?patient=${patient.id}`);
    } catch (error) {
      logDebug("Erro na submissão", error?.response?.data || error);
      console.error("Erro na submissão dos resultados", error);
      addToast("Erro ao guardar os resultados.", "error");
    }
  };

  const createReportIfNeeded = async (completed) => {
    if (!completed || !reportText || reportCreated) return;
    try {
      const pdfBlob = await generatePdfBlob();
      const formData = new FormData();
      formData.append("pdf_file", pdfBlob, `report_${patient.id}.pdf`);
      await createReport(formData, patient.id);
      setReportCreated(true);
    } catch (err) {
      console.error("Erro ao gerar o relatório:", err);
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

          {currentStep === 3 && (
            <ClinicalReportStep
              notes={clinicalNotes}
              onGenerate={handleGenerateReport}
              onNotesChange={handleNotesChange}
              onExport={handleExportPdf}
              onSubmit={handleUpdateEcho}
              canGenerate={isValidated}
              canSubmit={canSubmit}
              reportReady={Boolean(reportText)}
              submitLabel="Submeter"
            />
          )}
        </aside>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
