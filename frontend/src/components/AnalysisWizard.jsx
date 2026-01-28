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
    title: "Selecionar modo e preparar imagem",
    objective: "Defina o modo de anotação e ajuste a imagem.",
    cta: "Confirmar preparação da imagem",
  },
  {
    id: 2,
    title: "Anotar/Confirmar válvula",
    objective: "Delimite a válvula e confirme a anotação.",
    cta: "Confirmar anotação",
  },
  {
    id: 3,
    title: "Avaliar calcificação",
    objective: "Revise a VO, selecione a classificação e valide.",
    cta: "Validar avaliação clínica",
  },
  {
    id: 4,
    title: "Relatório clínico",
    objective: "Gere, edite e submeta o relatório.",
    cta: "Submeter",
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
  const [voOverrideValue, setVoOverrideValue] = useState(0);
  const [annotationStatusMessage, setAnnotationStatusMessage] = useState("");
  const [manualAdjustmentTriggered, setManualAdjustmentTriggered] = useState(false);
  const [toasts, setToasts] = useState([]);

  const annotationRevision = useRef(0);
  const confirmedAnnotationRevision = useRef(0);
  const assessmentRevision = useRef(0);
  const confirmedAssessmentRevision = useRef(0);
  const settingsLoaded = useRef(false);
  const isHydrating = useRef(true);

  const voBase = useMemo(() => normalizeVo(exam?.vo), [exam?.vo]);
  const voEffective = voOverrideEnabled ? voOverrideValue : voBase;
  const voSuggestion =
    voEffective !== null
      ? voEffective > VO_THRESHOLD
        ? "Calcificada"
        : "Não calcificada"
      : null;

  const isAnnotationReady = rects.some((frameRects) => frameRects?.length > 0);
  const hasPrediction = rects.some((frameRects) =>
    frameRects?.some((rect) => rect?.is_annotation_generated)
  );

  const canSubmit =
    completedSteps[1] && completedSteps[2] && completedSteps[3] && isValidated;

  const addToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
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
    if (voBase !== null && !voOverrideEnabled) {
      setVoOverrideValue(Math.round(voBase));
    }
  }, [voBase, voOverrideEnabled]);

  useEffect(() => {
    if (classificationChoice !== null) {
      setCalcificationStatus(classificationChoice);
    }
  }, [classificationChoice, setCalcificationStatus]);

  const handleAnnotationChanged = () => {
    annotationRevision.current += 1;
    if (currentStep === 2) {
      if (manualAdjustmentTriggered && mode === "ia") {
        setAnnotationStatusMessage("Anotação ajustada manualmente.");
        setManualAdjustmentTriggered(false);
      }
      if (mode === "manual" && !annotationStatusMessage) {
        setAnnotationStatusMessage("Anotação manual concluída.");
      }
    }
    if (completedSteps[2] || completedSteps[3]) {
      setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false, 4: false }));
      if (currentStep > 2) setCurrentStep(2);
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
      setCompletedSteps((prev) => ({ ...prev, 3: false, 4: false }));
      updateExamSettings(echoId, { validated: false });
      addToast("Alteração detetada. Revalide a avaliação clínica.", "warning");
    }
  }, [classificationChoice, voOverrideEnabled, voOverrideValue]);

  const handleConfirmStep = (stepId) => {
    setCompletedSteps((prev) => ({ ...prev, [stepId]: true }));
    setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  };

  const handleModeChange = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setAnnotationStatusMessage("");
    setUnsavedChanges(true);
    setCompletedSteps((prev) => ({ ...prev, 2: false, 3: false, 4: false }));
    setCurrentStep(1);
    addToast("Modo alterado. Reveja a anotação da válvula.", "info");
  };

  const handleConfirmAnnotation = () => {
    if (!isAnnotationReady) {
      addToast("Conclua a anotação antes de confirmar.", "error");
      return;
    }
    confirmedAnnotationRevision.current = annotationRevision.current;
    handleConfirmStep(2);
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
    setCompletedSteps((prev) => ({ ...prev, 3: true }));
    setCurrentStep(4);
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
  };

  const handleReportChange = async (value) => {
    setReportText(value);
    setUnsavedChanges(true);
    await updateExamSettings(echoId, {
      reportText: value,
      reportUpdatedAt: new Date().toISOString(),
    });
  };

  const handleNotesChange = async (value) => {
    setClinicalNotes(value);
    setUnsavedChanges(true);
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

  const handleExportPdf = async () => {
    if (!reportText) return;
    const pdfBlob = await generatePdfBlob();
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, "_blank");
  };

  const handleUpdateEcho = async (completed) => {
    try {
      if (!patient) return;
      const results = frames.map((frame, frameIndex) => ({
        frame_id: frame.id,
        rects: [...rects[frameIndex]],
        is_calcified: calcificationStatus,
        generated_calcium: calcification[frameIndex]?.is_calcification_generated,
      }));

      await updateExamSettings(echoId, {
        classificationOverride: classificationChoice,
        validated: isValidated,
        reportText,
        clinicalNotes,
        voOverrideEnabled,
        voOverrideValue,
      });

      await createReportIfNeeded(completed);

      await api.post(`/api/patient/${patient.id}/echocardiogram/${echoId}/submit/`, {
        results,
        completed,
        echoName: exam?.description || "",
      });

      setUnsavedChanges(false);
      addToast(completed ? "Resultados submetidos com sucesso." : "Rascunho guardado.", "success");
      if (completed) {
        navigate(`/patients?patient=${patient.id}`);
      }
    } catch (error) {
      console.error("Erro na submissão dos resultados", error);
      addToast("Erro ao guardar os resultados.", "error");
    }
  };

  const createReportIfNeeded = async (completed) => {
    if (!completed || !reportText) return;
    try {
      const pdfBlob = await generatePdfBlob();
      const formData = new FormData();
      formData.append("pdf_file", pdfBlob, `report_${patient.id}.pdf`);
      formData.append("reportText", reportText);
      await createReport(formData, patient.id);
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
              <div>
                <h3 className="text-base font-semibold text-green-dark">Selecionar modo</h3>
                <p className="text-sm text-gray-600">{steps[0].objective}</p>
              </div>
              <ModeSelector
                mode={mode}
                onChange={handleModeChange}
                disabled={currentStep !== 1}
              />
              <ImageToolsPanel
                imageSettings={imageSettings}
                onChange={onImageSettingsChange}
                onReset={() => onImageSettingsChange(defaultImageSettings)}
              />
              <button
                type="button"
                className="w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white"
                onClick={() => handleConfirmStep(1)}
              >
                Confirmar preparação da imagem
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <ValveAnnotationStep
              mode={mode}
              isAnnotationReady={isAnnotationReady}
              hasPrediction={hasPrediction}
              onManualStart={() => annotationToolRef.current?.iniciarAnotacaoManual()}
              onManualCancel={() => annotationToolRef.current?.cancelarAnotacaoManual()}
              onDetectIA={async () => {
                const result = await annotationToolRef.current?.detetarValvulaIA();
                if (result) {
                  setAnnotationStatusMessage("Válvula identificada.");
                  addToast("Válvula identificada.", "success");
                } else {
                  addToast("Não foi possível detetar a válvula.", "error");
                }
              }}
              onAdjustManual={() => {
                annotationToolRef.current?.ajustarManual();
                setAnnotationStatusMessage("Ajuste manual ativo.");
                setManualAdjustmentTriggered(true);
              }}
              onResetIA={() => annotationToolRef.current?.reporAnotacaoIA()}
              onClear={() => annotationToolRef.current?.limparAnotacoes()}
              onConfirm={handleConfirmAnnotation}
              statusMessage={annotationStatusMessage}
            />
          )}

          {currentStep === 3 && (
            <CalcificationAssessmentStep
              voValue={voEffective !== null ? voEffective : null}
              voSuggestion={voSuggestion}
              voEditable={!isValidated}
              voOverrideValue={voOverrideValue}
              onToggleVoOverride={(checked) => {
                setVoOverrideEnabled(checked);
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
              isVoOverrideActive={voOverrideEnabled}
              classificationChoice={classificationChoice}
              onClassificationChange={(value) => {
                setClassificationChoice(value);
                setUnsavedChanges(true);
              }}
              isValidated={isValidated}
              onValidate={handleValidateAssessment}
              onEditValidation={handleEditValidation}
              showManualBadge={voOverrideEnabled}
            />
          )}

          {currentStep === 4 && (
            <ClinicalReportStep
              reportText={reportText}
              notes={clinicalNotes}
              onGenerate={handleGenerateReport}
              onReportChange={handleReportChange}
              onNotesChange={handleNotesChange}
              onSaveDraft={() => handleUpdateEcho(false)}
              onExport={handleExportPdf}
              onSubmit={() => handleUpdateEcho(true)}
              canGenerate={isValidated}
              canSubmit={canSubmit}
              readyToSubmit={canSubmit}
            />
          )}
        </aside>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
