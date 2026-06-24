const REPORT_STATUS_LABELS = {
  AUTO_GENERATED: "Gerado automaticamente",
  USER_REVIEWED: "Revisto pelo utilizador",
  READY: "Pronto para exportação",
  FAILED: "Falhou",
};

const DEFAULT_MODALITY = "Ecocardiograma DICOM";

const formatDate = (value, withTime = false) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-PT", withTime
    ? {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

export const normalizeObjectiveVariable = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1 ? numeric : numeric * 100;
};

export const getCalcificationLabel = (value) =>
  value === null || value === undefined ? "Não definida" : value ? "Calcificada" : "Não calcificada";

export const getReportStatusLabel = (status) =>
  REPORT_STATUS_LABELS[status] || "Rascunho";

export const buildReportFilename = ({ patient, exam }) => {
  const patientSlug =
    patient?.name
      ?.trim()
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `paciente_${patient?.id || "desconhecido"}`;

  const examSlug =
    exam?.description
      ?.trim()
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `exame_${exam?.id || "clinico"}`;

  const examDate = exam?.uploaded_at || exam?.date || new Date().toISOString();
  const date = new Date(examDate);
  const datePart = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10).replaceAll("-", "")
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
        date.getDate()
      ).padStart(2, "0")}`;

  return `relatorio_clinico_${patientSlug}_${examSlug}_${datePart}.pdf`;
};

export const getInitialClinicalReportInputs = (reportData) => ({
  valveObservations:
    reportData?.findings?.validated_observations ||
    reportData?.findings?.summary ||
    "",
  validationNotes:
    reportData?.validation?.reviewer_notes ||
    "",
  conclusion:
    reportData?.conclusion?.final_text ||
    "",
});

export const buildClinicalReportDraft = ({
  patient,
  exam,
  user,
  frames = [],
  rects = [],
  calcification = [],
  classificationChoice,
  voValue,
  inputs,
  isValidated,
}) => {
  const annotatedFrames = rects.filter((frameRects) => (frameRects || []).length > 0).length;
  const calcifiedFrames = calcification.filter((item) => item?.binary_classification === true).length;
  const aiDetections = calcification.filter((item) => item?.is_calcification_generated === true).length;
  const objectiveVariable = normalizeObjectiveVariable(voValue);
  const classificationLabel = getCalcificationLabel(classificationChoice);
  const frameCount = frames.length;
  const examDate = exam?.uploaded_at || exam?.date || null;

  const autoFindings = [];
  if (objectiveVariable !== null) {
    autoFindings.push(`Índice de calcificação estimado em ${Math.round(objectiveVariable)}/100.`);
  } else {
    autoFindings.push("Sem índice objetivo disponível nesta análise.");
  }
  autoFindings.push(
    classificationChoice === null
      ? "A classificação automática ainda não foi confirmada clinicamente."
      : `Resultado sugerido pela análise: válvula ${classificationLabel.toLowerCase()}.`
  );
  if (annotatedFrames > 0) {
    autoFindings.push(
      `${annotatedFrames} de ${frameCount || 0} frame(s) tiveram ROI da válvula definida para análise.`
    );
  }
  if (calcifiedFrames > 0) {
    autoFindings.push(`${calcifiedFrames} frame(s) foram marcados como calcificados.`);
  }

  const reviewerName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "Utilizador";
  const automaticSummaryIndicators = [
    {
      label: "Resultado IA",
      value: classificationLabel,
    },
    {
      label: "Índice de calcificação",
      value: objectiveVariable !== null ? `${Math.round(objectiveVariable)}/100` : "N/D",
    },
    {
      label: "Frames com ROI",
      value: `${annotatedFrames}/${frameCount || 0}`,
    },
    {
      label: "Frames calcificados",
      value: `${calcifiedFrames}/${frameCount || 0}`,
    },
  ];

  return {
    title: `Relatório clínico - ${exam?.description || `Exame #${exam?.id || "N/D"}`}`,
    generated_at: new Date().toISOString(),
    identification: {
      patient_name: patient?.name || "N/D",
      patient_id: patient?.id ?? null,
      exam_id: exam?.id ?? null,
      exam_label: exam?.description || `Exame #${exam?.id || "N/D"}`,
      exam_date: examDate,
      exam_date_label: formatDate(examDate),
      modality: DEFAULT_MODALITY,
    },
    automatic_summary: {
      ai_result: classificationLabel,
      calcification_presence: classificationChoice === null ? "Por confirmar" : classificationLabel,
      grade: objectiveVariable === null ? "N/D" : objectiveVariable >= 50 ? "Elevado" : objectiveVariable >= 30 ? "Intermédio" : "Baixo",
      indicators: automaticSummaryIndicators,
      context_note:
        "Resultado gerado automaticamente a partir da análise da válvula. Deve ser revisto clinicamente antes da exportação.",
    },
    findings: {
      valve_state:
        classificationChoice === null
          ? "Estado valvular por confirmar"
          : classificationChoice
          ? "Achados compatíveis com calcificação valvular"
          : "Sem sinais marcados de calcificação valvular",
      calcification_presence: classificationLabel,
      auto_findings: autoFindings,
      validated_observations: inputs?.valveObservations?.trim() || "",
      summary:
        inputs?.valveObservations?.trim() ||
        "Sem observações clínicas adicionais registadas nesta revisão.",
    },
    measurements: [
      {
        label: "Índice de calcificação (VO)",
        value: objectiveVariable !== null ? `${Math.round(objectiveVariable)}/100` : "N/D",
      },
      {
        label: "Frames analisados",
        value: frameCount || "0",
      },
      {
        label: "Frames com ROI válida",
        value: annotatedFrames || "0",
      },
      {
        label: "Frames marcados como calcificados",
        value: calcifiedFrames || "0",
      },
      {
        label: "Deteções IA aplicadas",
        value: aiDetections || "0",
      },
    ],
    validation: {
      auto_generated_fields: [
        "Identificação do exame",
        "Resumo automático da análise",
        "Medições quantitativas",
      ],
      reviewer_name: reviewerName,
      reviewer_notes:
        inputs?.validationNotes?.trim() || "Sem notas adicionais de validação.",
      validation_status: isValidated ? "Validado clinicamente" : "Pendente de validação clínica",
      last_reviewed_at: new Date().toISOString(),
      is_user_validated: Boolean(isValidated),
    },
    conclusion: {
      final_text:
        inputs?.conclusion?.trim() ||
        (classificationChoice === null
          ? "Conclusão pendente. Confirme a classificação e reveja os achados antes de finalizar o relatório."
          : classificationChoice
          ? "Achados compatíveis com calcificação valvular aórtica. Correlacionar com avaliação clínica e restante estudo ecocardiográfico."
          : "Sem evidência relevante de calcificação valvular aórtica nesta análise. Correlacionar com a avaliação clínica global."),
      user_edited: Boolean(inputs?.conclusion?.trim()),
    },
  };
};

export const isClinicalReportReady = (reportData) => {
  if (!reportData) return false;
  if (!reportData.identification) return false;
  if (!reportData.automatic_summary) return false;
  if (!reportData.measurements?.length) return false;
  if (!reportData.validation) return false;
  return Boolean(reportData.conclusion?.final_text?.trim());
};

export const extractClinicalReportMeta = (report) => ({
  status: report?.status || null,
  reportId: report?.id || null,
  title: report?.title || "",
  hasPdf: Boolean(report?.has_pdf),
  lastError: report?.last_error || "",
  updatedAt: report?.updated_at || null,
});

export const formatClinicalTimestamp = (value) => formatDate(value, true);
