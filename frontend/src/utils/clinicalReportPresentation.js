const CLINICAL_CONTEXT_NOTE =
  "Resultado automático assistido por inteligência artificial, sujeito a interpretação clínica e validação do profissional responsável.";

const CLINICAL_FRAMEWORK_NOTE =
  "Resultado a interpretar em conjunto com a avaliação clínica, os restantes parâmetros ecocardiográficos e a qualidade da janela acústica.";

const TEST_TEXT_VALUES = new Set([".", "..", "...", "ola", "olá", "teste", "test"]);

const parsePercentage = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace("%", "").replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1 ? numeric : numeric * 100;
};

const formatPercentage = (value) => {
  const numeric = parsePercentage(value);
  if (numeric === null) return "N/D";
  return `${numeric.toFixed(1)}%`;
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const isMeaningfulClinicalText = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  return !TEST_TEXT_VALUES.has(normalizeText(text));
};

const cleanClinicalNotes = (value) =>
  isMeaningfulClinicalText(value) ? String(value).trim() : "Sem observações adicionais.";

const getHighlightValue = (items = [], label) =>
  items.find((item) => normalizeText(item?.label) === normalizeText(label))?.value;

const summarizeSeverity = (voPercentage) => {
  if (voPercentage === null) return "N/D";
  if (voPercentage >= 60) return "Elevada";
  if (voPercentage >= 30) return "Moderada";
  return "Baixa";
};

const summarizeRisk = (voPercentage) => {
  if (voPercentage === null) return "N/D";
  if (voPercentage >= 60) return "Elevado";
  if (voPercentage >= 30) return "Moderado";
  return "Baixo";
};

const hasCalcification = (source, voPercentage, calcifiedFrames) => {
  const raw =
    source?.calcification_present ??
    source?.has_calcification ??
    source?.automatic_summary?.calcification_present;

  if (typeof raw === "boolean") return raw;
  if (calcifiedFrames > 0) return true;
  return voPercentage !== null && voPercentage >= 30;
};

const buildConclusion = ({ voPercentage, classification, risk, calcificationPresent }) => {
  if (calcificationPresent) {
    return `A análise assistida por inteligência artificial sugere presença de calcificação valvular aórtica no conjunto de imagens analisado, com índice de calcificação calculado de ${formatPercentage(
      voPercentage
    )}. A classificação estimada é ${classification.toLowerCase()} e o risco estimado é ${risk.toLowerCase()}. Este resultado deve ser interpretado em conjunto com a avaliação clínica, os restantes parâmetros ecocardiográficos e a validação do profissional responsável.`;
  }

  return `A análise assistida por inteligência artificial não identificou sinais relevantes de calcificação valvular aórtica no conjunto de imagens analisado. O índice de calcificação calculado foi de ${formatPercentage(
    voPercentage
  )}, enquadrado como baixo risco. Este resultado deve ser interpretado em conjunto com a avaliação clínica, os restantes parâmetros ecocardiográficos e a validação do profissional responsável.`;
};

const shouldReplaceConclusion = (value) => {
  if (!isMeaningfulClinicalText(value)) return true;
  const text = normalizeText(value);
  return (
    text.includes("achados compativeis") ||
    text.includes("sem evidencia relevante") ||
    text.includes("conclusao pendente") ||
    text.includes("resultado gerado automaticamente")
  );
};

const normalizeMetricRows = (rows = []) =>
  rows.map((row) => ({
    ...row,
    interpretation:
      row?.interpretation === "Frames classificados com achados compatíveis com calcificação."
        ? "Frames classificados como compatíveis com calcificação."
        : row?.interpretation,
  }));

const buildMetricRows = (source, voPercentage, annotatedFrames, calcifiedFrames) => {
  const existing = source?.metrics?.rows || source?.measurements || [];
  if (existing.length) {
    return normalizeMetricRows(
      existing.map((item) => ({
        label: item.label,
        value: item.value,
        unit: item.unit || "",
        interpretation: item.interpretation || "",
      }))
    );
  }

  return [
    {
      label: "Índice de calcificação (VO)",
      value: formatPercentage(voPercentage),
      unit: "%",
      interpretation: "Quantificação automática da calcificação na região de interesse.",
    },
    {
      label: "Frames com ROI válida",
      value: String(annotatedFrames || 0),
      unit: "frames",
      interpretation: "Imagens com região de interesse definida para análise.",
    },
    {
      label: "Frames compatíveis com calcificação",
      value: String(calcifiedFrames || 0),
      unit: "frames",
      interpretation: "Frames classificados como compatíveis com calcificação.",
    },
  ];
};

export function getClinicalReportPresentation(report, overrides = {}) {
  const source = report || {};
  const summarySource = source.automatic_summary || {};
  const findingsSource = source.findings || {};
  const validationSource = source.validation || {};
  const conclusionSource = source.conclusion || {};
  const highlights = summarySource.indicators || [];

  const voPercentage =
    parsePercentage(source.objective_variable_percentage) ??
    parsePercentage(summarySource.objective_variable_percentage) ??
    parsePercentage(getHighlightValue(highlights, "Índice de calcificação")) ??
    parsePercentage(getHighlightValue(highlights, "Índice de calcificação (VO)"));

  const annotatedFrames = Number(source.annotated_frames ?? source.frames_with_roi ?? 0);
  const calcifiedFrames = Number(source.calcified_frames ?? 0);
  const calcificationPresent = hasCalcification(source, voPercentage, calcifiedFrames);
  const lowNonZero = !calcificationPresent && voPercentage !== null && voPercentage > 0 && voPercentage < 30;

  const classification = lowNonZero ? "Baixa" : summarySource.classification || summarySource.grade || summarizeSeverity(voPercentage);
  const risk = lowNonZero ? "Baixo" : summarySource.risk || summarizeRisk(voPercentage);
  const calcificationLabel = calcificationPresent ? "Presente" : lowNonZero ? "Não significativa" : "Ausente";
  const aiResult = calcificationPresent ? "Calcificação identificada" : lowNonZero ? "Sem calcificação significativa" : "Ausente";

  const generatedConclusion = buildConclusion({
    voPercentage,
    classification,
    risk,
    calcificationPresent,
  });
  const currentConclusion = overrides.clinicalConclusion ?? conclusionSource.final_text ?? "";
  const finalConclusion = shouldReplaceConclusion(currentConclusion)
    ? generatedConclusion
    : String(currentConclusion).trim();

  const notes = overrides.clinicalNotes ?? validationSource.reviewer_notes ?? source.clinical_notes ?? "";

  const identificationItems = [
    { label: "Paciente", value: source.patient_name || source.identification?.patient_name || "N/D" },
    { label: "Identificador", value: source.patient_id ?? source.identification?.patient_id ?? "N/D" },
    { label: "Exame selecionado", value: source.exam_description || source.identification?.exam_label || "N/D" },
    { label: "Data do exame", value: source.exam_date_label || source.identification?.exam_date_label || source.exam_date || "N/D" },
    { label: "Modalidade", value: source.modality || source.identification?.modality || "Ecocardiograma DICOM" },
  ];

  return {
    identification: {
      title: source.identification?.title || "Identificação do paciente",
      items: identificationItems,
    },
    summary: {
      title: "Resultado da análise",
      ai_result: aiResult,
      calcification_presence: calcificationLabel,
      classification,
      risk,
      context_note: CLINICAL_CONTEXT_NOTE,
    },
    findings: {
      title: "Avaliação da válvula aórtica",
      items: [
        {
          label: "Avaliação da válvula",
          value: calcificationPresent
            ? "A análise indica sinais compatíveis com calcificação valvular aórtica no conjunto de imagens analisado."
            : "Não foram identificados sinais relevantes de calcificação valvular aórtica no conjunto de imagens analisado.",
        },
        {
          label: "Presença de calcificação",
          value: calcificationPresent
            ? `Calcificação identificada em ${calcifiedFrames} de ${annotatedFrames} frames com ROI válida.`
            : "Sem calcificação relevante nos frames com ROI válida.",
        },
        {
          label: "Enquadramento clínico",
          value: findingsSource.summary || CLINICAL_FRAMEWORK_NOTE,
        },
      ],
    },
    metrics: {
      title: source.metrics?.title || "Métricas",
      rows: buildMetricRows(source, voPercentage, annotatedFrames, calcifiedFrames),
    },
    validation: {
      status: validationSource.validation_status || (source.status === "READY" ? "Validado clinicamente" : "Pendente de validação clínica"),
      professional_notes: cleanClinicalNotes(notes),
    },
    conclusion: {
      title: "Conclusão clínica",
      final_text: finalConclusion,
    },
  };
}
