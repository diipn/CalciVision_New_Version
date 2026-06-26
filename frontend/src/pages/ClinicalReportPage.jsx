import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";

import ClinicalReportPdfDocument from "../components/ClinicalReportPdfDocument";
import ClinicalReportStep from "../components/ClinicalReportStep";
import MainLayout from "../layouts/MainLayout";
import {
  downloadClinicalReport,
  getClinicalReport,
  getEchocardiogramFrames,
  getExamSettings,
  submitExamAnalysis,
  updateExamSettings,
  upsertClinicalReport,
} from "../api";
import {
  clearStoredClinicalReportDraft,
  readStoredClinicalReportDraft,
  writeStoredClinicalReportDraft,
} from "../utils/clinicalReportDraft";

const buildFrameResults = (frames, rects, calcification, calcificationStatus) =>
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

    return {
      frame_id: frame.id,
      rects: cleanedRects,
      is_calcified: isCalcified,
      generated_calcium:
        typeof frameCalc?.is_calcification_generated === "boolean"
          ? frameCalc.is_calcification_generated
          : null,
    };
  });

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

const triggerFileDownload = (blob, filename) => {
  const normalizedFilename = filename?.toLowerCase().endsWith(".pdf") ? filename : `${filename || "relatorio_clinico"}.pdf`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = normalizedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export default function ClinicalReportPage() {
  const { patientId, echoId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState("");
  const [validatedSummary, setValidatedSummary] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [clinicalConclusion, setClinicalConclusion] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reportNotice, setReportNotice] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      if (!patientId || !echoId) return;

      setReportLoading(true);
      setReportError("");

      try {
        const response = await getClinicalReport(patientId, echoId);
        const storedDraft = readStoredClinicalReportDraft(patientId, echoId);
        const nextReport = response || storedDraft;

        if (!nextReport) {
          setReport(null);
          return;
        }

        setReport(nextReport);
        setValidatedSummary(nextReport.validated_summary || "");
        setClinicalNotes(nextReport.clinical_notes || "");
        setClinicalConclusion(nextReport.clinical_conclusion || "");
        setIsEditing(false);
        writeStoredClinicalReportDraft(patientId, echoId, nextReport);
      } catch (error) {
        console.error("Erro ao carregar a página do relatório:", error);
        const storedDraft = readStoredClinicalReportDraft(patientId, echoId);
        if (storedDraft) {
          setReport(storedDraft);
          setValidatedSummary(storedDraft.validated_summary || "");
          setClinicalNotes(storedDraft.clinical_notes || "");
          setClinicalConclusion(storedDraft.clinical_conclusion || "");
          setReportError(
            "Foi carregada a última versão local do relatório porque o backend não devolveu o documento persistido."
          );
        } else {
          setReportError(
            buildReportErrorMessage(
              error,
              "Não foi possível carregar o relatório clínico deste exame."
            )
          );
        }
      } finally {
        setReportLoading(false);
      }
    };

    loadReport();
  }, [patientId, echoId]);

  const hasUnsavedChanges = useMemo(
    () =>
      (validatedSummary || "") !== (report?.validated_summary || "") ||
      (clinicalNotes || "") !== (report?.clinical_notes || "") ||
      (clinicalConclusion || "") !== (report?.clinical_conclusion || ""),
    [report, validatedSummary, clinicalNotes, clinicalConclusion]
  );

  const canFinalize = useMemo(
    () =>
      Boolean(report || validatedSummary || clinicalNotes || clinicalConclusion) &&
      report?.status !== "READY" &&
      !isEditing &&
      !hasUnsavedChanges,
    [report, validatedSummary, clinicalNotes, clinicalConclusion, isEditing, hasUnsavedChanges]
  );

  const persistReport = async ({ markReady, syncAnalysis }) => {
    if (!patientId || !echoId) {
      throw new Error("Não existe contexto suficiente para guardar o relatório.");
    }

    setReportSaving(true);
    setReportError("");
    setReportNotice("");

    try {
      const examSettings = await getExamSettings(echoId);
      const savedProgressRaw = localStorage.getItem(`exam-progress-${echoId}`);

      let results;
      let analysisSyncWarning = "";
      if (savedProgressRaw) {
        try {
          const savedProgress = JSON.parse(savedProgressRaw);
          const rects = Array.isArray(savedProgress?.rects) ? savedProgress.rects : [];
          const calcification = Array.isArray(savedProgress?.calcification)
            ? savedProgress.calcification
            : [];

          if (rects.length > 0 || calcification.length > 0) {
            const frames = await getEchocardiogramFrames(patientId, echoId);
            const builtResults = buildFrameResults(
              frames,
              rects,
              calcification,
              examSettings?.classificationOverride
            );
            if (hasAnnotatedFrameResults(builtResults)) {
              results = builtResults;
            }
          }
        } catch {
          results = undefined;
        }
      }

      if (syncAnalysis && results?.length) {
        try {
          const payload = {
            results,
            completed: true,
          };

          if (report?.exam_description) {
            payload.echoName = report.exam_description;
          }

          await submitExamAnalysis(patientId, echoId, payload);
        } catch (syncError) {
          console.error("Erro ao sincronizar a análise durante a validação do relatório:", syncError);
          analysisSyncWarning =
            "O relatório foi validado, mas a análise do exame não foi sincronizada no backend.";
        }
      }

      const nextReport = await upsertClinicalReport(patientId, echoId, {
        results,
        classification_choice: examSettings?.classificationOverride ?? null,
        validated_summary: validatedSummary,
        clinical_notes: clinicalNotes,
        clinical_conclusion: clinicalConclusion,
        mark_ready: markReady,
      });

      setReport(nextReport);
      setValidatedSummary(nextReport.validated_summary || "");
      setClinicalNotes(nextReport.clinical_notes || "");
      setClinicalConclusion(nextReport.clinical_conclusion || "");
      setIsEditing(false);

      await updateExamSettings(echoId, {
        clinicalNotes: nextReport.clinical_notes || "",
        validatedSummary: nextReport.validated_summary || "",
        clinicalConclusion: nextReport.clinical_conclusion || "",
      });

      writeStoredClinicalReportDraft(patientId, echoId, nextReport);
      return { report: nextReport, analysisSyncWarning };
    } catch (error) {
      const backendReport = error?.response?.data?.report;
      if (backendReport) {
        setReport(backendReport);
        writeStoredClinicalReportDraft(patientId, echoId, backendReport);
      }

      const message = buildReportErrorMessage(
        error,
        markReady
          ? "Não foi possível validar o relatório clínico."
          : "Não foi possível guardar as alterações do relatório."
      );
      setReportError(message);
      throw new Error(message);
    } finally {
      setReportSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const result = await persistReport({ markReady: false, syncAnalysis: false });
      if (result?.report) {
        setReportNotice("Alterações guardadas. É necessária nova validação antes do PDF.");
      }
    } catch (error) {
      console.error("Erro ao guardar alterações:", error);
    }
  };

  const handleFinalize = async () => {
    try {
      const result = await persistReport({ markReady: true, syncAnalysis: true });
      if (result?.report?.is_exportable) {
        clearStoredClinicalReportDraft(patientId, echoId);
      }
      setReportNotice(
        result?.analysisSyncWarning || "Relatório validado. O PDF já pode ser transferido."
      );
    } catch (error) {
      console.error("Erro ao validar relatório:", error);
    }
  };

  const handleExport = async () => {
    if (!report?.id || !report?.is_exportable || isEditing || hasUnsavedChanges) {
      setReportError("Valide o relatório final antes de transferir o PDF.");
      return;
    }

    try {
      const document = <ClinicalReportPdfDocument report={report} />;
      const asPdf = pdf([]);
      asPdf.updateContainer(document);
      const blob = await asPdf.toBlob();

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("O ficheiro PDF gerado está vazio.");
      }

      triggerFileDownload(blob, report.download_filename);
      setReportNotice("PDF transferido com sucesso.");
    } catch (error) {
      console.error("Erro ao transferir PDF via documento dedicado. A tentar fallback do backend:", error);

      try {
        await downloadClinicalReport(report.id, report.download_filename);
        setReportNotice("PDF transferido com sucesso.");
      } catch (downloadError) {
        console.error("Erro ao transferir PDF:", downloadError);
        setReportError(downloadError.message || "Não foi possível transferir o PDF.");
      }
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setReportNotice("");
  };

  const handleCancelEditing = () => {
    setValidatedSummary(report?.validated_summary || "");
    setClinicalNotes(report?.clinical_notes || "");
    setClinicalConclusion(report?.clinical_conclusion || "");
    setIsEditing(false);
    setReportError("");
  };

  return (
    <MainLayout pageTitle="Relatório clínico">
      <div className="mx-auto w-full max-w-[1560px] pb-6">
        <ClinicalReportStep
          report={report}
          reportLoading={reportLoading}
          reportSaving={reportSaving}
          reportError={reportError}
          reportNotice={reportNotice}
          clinicalNotes={clinicalNotes}
          clinicalConclusion={clinicalConclusion}
          onNotesChange={setClinicalNotes}
          onConclusionChange={setClinicalConclusion}
          isEditing={isEditing}
          hasUnsavedChanges={hasUnsavedChanges}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          onSaveChanges={handleSaveChanges}
          onFinalize={handleFinalize}
          onExport={handleExport}
          canFinalize={canFinalize}
          isExportAvailable={Boolean(report?.is_exportable) && !isEditing && !hasUnsavedChanges}
          backToAnalysisHref={`/analyse_aortic_valve/${patientId}/${echoId}`}
          submitLabel="Validar relatório"
        />

        {!reportLoading && !report && !reportError ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-6 text-sm text-gray-600 shadow-sm">
            Este exame ainda não tem relatório gerado.{" "}
            <button
              type="button"
              className="font-semibold text-green-dark underline"
              onClick={() => navigate(`/analyse_aortic_valve/${patientId}/${echoId}`)}
            >
              Voltar à análise
            </button>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
