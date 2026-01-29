import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { createReport, getEchoResults, getExamSettings, updateExamSettings } from "../api";
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
  annotationToolRef,
  frames,
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
}) {
  const navigate = useNavigate();
  const { user } = useUser();
  const { setUnsavedChanges } = useUnsavedStore();

  const [mode, setMode] = useState("manual");
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
  const [classificationTouched, setClassificationTouched] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
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
  const canSubmit = completedSteps[1] && completedSteps[2] && isValidated;

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
    confirmedAnnotationRevision.current = annotationRevision.current;
    setCompletedSteps((prev) => ({ ...prev, 1: true }));
    setCurrentStep(2);
    addToast("Anotação confirmada.", "success");
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
    const template = `RELATÓRIO CLÍNICO - CALCIVISION\n\nPaciente: ${patient.name}\nData do exame: ${new Date(exam.date).toLocaleDateString("pt-PT")}\nVariável Objectiva (VO): ${
      voEffective !== null ? `${voEffective.toFixed(0)}%` : "N/A"
    }\nClassificação: ${classificationLabel}\n\nObservações automáticas:\n- Comparação longitudinal recomendada para acompanhar a progressão.\n- Este resultado é uma simulação e não substitui a decisão clínica.\n\nObservações clínicas:\n${clinicalNotes || "—"}\n\nAssinatura: ${user?.first_name || "Médico"} ${user?.last_name || ""}`;
    setReportText(template);
    setUnsavedChanges(true);
    await updateExamSettings(echoId, { reportText: template });
    try {
      const pdfBlob = await generatePdfBlob();
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
    setNotesDirty(true);
    await updateExamSettings(echoId, { clinicalNotes: value });
  };

  const generatePdfBlob = async () => {
    const echoData = await getEchoResults(patient.id);
    const combinedReport = reportText;
    const doc = (
      <ReportPDF
        data={echoData}
        patient={patient}
        medico={user}
        reportText={combinedReport}
      />
    );
    const asPdf = pdf([]);
    asPdf.updateContainer(doc);
    return asPdf.toBlob();
  };

  const handleAutoQuantifyVO = async () => {
  if (isValidated) return;

  const randomValue = Math.floor(Math.random() * 101); // 0–100

  // VO efectiva deve mudar -> override tem de ficar ON
  setVoOverrideEnabled(true);
  setVoOverrideValue(randomValue);

  // mas NÃO queremos abrir modo manual / checkbox marcada
  setVoManualUiEnabled(false);

  setUnsavedChanges(true);
  addToast(`VO quantificada automaticamente: ${randomValue}/100`, "success");

  try {
    await updateExamSettings(echoId, {
      voOverrideEnabled: true,      // ✅ igual ao state
      voOverrideValue: randomValue,
    });
  } catch (error) {
    console.error("Erro ao guardar VO automática:", error);
    addToast("Não foi possível guardar a VO automática.", "error");
  }
};

  const handleExportPdf = async () => {
    if (!reportText) return;
    const pdfBlob = await generatePdfBlob();
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, "_blank");
  };

  const handleUpdateEcho = async (completed) => {
    try {
      if (!patient) return;
      const results = frames.map((frame, frameIndex) => {
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

      await updateExamSettings(echoId, {
        classificationOverride: classificationChoice,
        validated: isValidated,
        reportText,
        clinicalNotes,
        voOverrideEnabled,
        voOverrideValue,
      });

      await createReportIfNeeded(completed);

      const payload = {
        results,
        completed,
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
      setNotesDirty(false);
      addToast(completed ? "Resultados submetidos com sucesso." : "Rascunho guardado.", "success");
      if (completed) {
        navigate(`/patients?patient=${patient.id}`);
      }
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
  const modeLabel = mode === "manual" ? "Manual" : "IA";

  return (
    <div className="w-full space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Anotação da Válvula Aórtica — {modeLabel}
            </h1>
            <p className="text-sm text-gray-600">
              Siga os passos para concluir a análise e gerar o relatório.
            </p>
          </div>
          <div className="rounded-full bg-green-50 px-4 py-1 text-sm font-semibold text-green-dark">
            Passo {currentStep} de {steps.length} — {stepTitle}
          </div>
        </div>
      </header>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {renderCanvas ? renderCanvas(handleAnnotationChanged) : null}
        </div>
        <aside className="rounded-lg border border-green-pale bg-white p-5 shadow-sm">
          {currentStep === 1 && (
            <div className="space-y-4">
              <ModeSelector
                mode={mode}
                onChange={handleModeChange}
                disabled={currentStep !== 1}
                showDescription={false}
              />
              <ValveAnnotationStep
                mode={mode}
                isManualActive={manualActionActive}
                isAiActive={aiActionActive}
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
              {annotationStatusMessage && (
                <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
                  {annotationStatusMessage}
                </div>
              )}
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
                onAutoEnhanceToggle={(enabled) => {
                  setAutoEnhanceEnabled(enabled);
                  if (enabled) {
                    onImageSettingsChange({
                      ...imageSettings,
                      brightness: 1.1,
                      contrast: 1.2,
                      blur: 0.6,
                      zoom: imageSettings?.zoom ?? 1,
                    });
                  } else {
                    onImageSettingsChange(defaultImageSettings);
                  }
                }}
              />
              <button
                type="button"
                className="w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white"
                onClick={handleConfirmAnnotation}
              >
                Confirmar anotação
              </button>
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
              onSaveDraft={() => handleUpdateEcho(false)}
              onExport={handleExportPdf}
              onSubmit={() => handleUpdateEcho(true)}
              canGenerate={isValidated}
              canSubmit={canSubmit}
              notesDirty={notesDirty}
              reportReady={Boolean(reportText)}
            />
          )}
        </aside>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
