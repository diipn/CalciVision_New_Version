import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getPatientAge } from "../utils/patientAge";
import {
  buildClinicalReportDraft,
  getCalcificationLabel,
  normalizeObjectiveVariable,
} from "../utils/clinicalReport";
import { isMeaningfulClinicalText } from "../utils/clinicalReportPresentation";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.35,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 14,
    borderBottom: "1 solid #d8e6dc",
    paddingBottom: 10,
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f7a53",
  },
  subtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    fontSize: 8,
    color: "#475569",
  },
  section: {
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
    border: "1 solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  label: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 9.5,
    color: "#0f172a",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 999,
    border: "1 solid #cfe7d6",
    backgroundColor: "#edf8f1",
    fontSize: 8,
    color: "#1f7a53",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bullet: {
    width: 10,
    color: "#1f7a53",
  },
  listText: {
    flex: 1,
  },
  table: {
    border: "1 solid #dbe7de",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e2e8f0",
  },
  tableHeader: {
    backgroundColor: "#edf8f1",
    fontWeight: "bold",
  },
  cellLabel: {
    width: "48%",
    padding: 7,
    fontSize: 8.5,
    color: "#334155",
  },
  cellValue: {
    width: "52%",
    padding: 7,
    fontSize: 8.5,
    color: "#0f172a",
  },
  note: {
    fontSize: 8.5,
    color: "#334155",
  },
  conclusionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#edf8f1",
    border: "1 solid #cfe7d6",
  },
  conclusionText: {
    fontSize: 9.5,
    color: "#0f172a",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTop: "1 solid #e2e8f0",
    fontSize: 8,
    color: "#64748b",
  },
});

const renderList = (items) =>
  (items || []).map((item, index) => (
    <View key={`${index}-${item}`} style={styles.listItem}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.listText}>{item}</Text>
    </View>
  ));

const buildLegacyReportData = ({ data = [], patient, medico, reportText }) => {
  const totalFrames = data.length;
  const calcifiedFrames = data.filter((item) => item?.is_calcified).length;
  const objectiveVariable = normalizeObjectiveVariable(
    totalFrames > 0 ? (calcifiedFrames / totalFrames) * 100 : null
  );

  return buildClinicalReportDraft({
    patient,
    exam: {
      id: null,
      description: "Exame ecocardiográfico",
      uploaded_at: new Date().toISOString(),
    },
    user: medico,
    frames: data.map((_, index) => ({ id: index })),
    rects: data.map((item) => (item?.rects ? [item.rects] : [])),
    calcification: data.map((item) => ({
      binary_classification: item?.is_calcified ?? null,
      is_calcification_generated: item?.is_calcification_generated ?? null,
    })),
    classificationChoice: calcifiedFrames > 0,
    voValue: objectiveVariable,
    inputs: {
      valveObservations: reportText || "",
      validationNotes: "",
      conclusion:
        calcifiedFrames > 0
          ? "Achados compatíveis com calcificação valvular aórtica."
          : "Sem evidência relevante de calcificação valvular nesta análise.",
    },
    isValidated: true,
  });
};

const ReportPDF = ({ reportData, data, patient, medico, reportText }) => {
  const resolvedReportData =
    reportData || buildLegacyReportData({ data, patient, medico, reportText });
  const identification = resolvedReportData.identification || {};
  const automaticSummary = resolvedReportData.automatic_summary || {};
  const findings = resolvedReportData.findings || {};
  const measurements = resolvedReportData.measurements || [];
  const validation = resolvedReportData.validation || {};
  const conclusion = resolvedReportData.conclusion || {};
  const patientAge = patient ? getPatientAge(patient) : null;
  const reportDate = new Date(resolvedReportData.generated_at || Date.now()).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CalciVision</Text>
          <Text style={styles.subtitle}>Relatório clínico estruturado da análise da válvula aórtica</Text>
          <View style={styles.metaRow}>
            <Text>{resolvedReportData.title || "Relatório clínico"}</Text>
            <Text>Gerado em {reportDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificação do paciente e do exame</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Paciente</Text>
              <Text style={styles.value}>{identification.patient_name || patient?.name || "N/D"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Identificador</Text>
              <Text style={styles.value}>{identification.patient_id ?? patient?.id ?? "N/D"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Data do exame</Text>
              <Text style={styles.value}>{identification.exam_date_label || "N/D"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Exame selecionado</Text>
              <Text style={styles.value}>{identification.exam_label || "N/D"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Modalidade</Text>
              <Text style={styles.value}>{identification.modality || "N/D"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Idade</Text>
              <Text style={styles.value}>{patientAge !== null ? `${patientAge} anos` : "N/D"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultado da análise</Text>
          <View style={styles.chipRow}>
            {(automaticSummary.indicators || []).map((indicator) => (
              <Text key={indicator.label} style={styles.chip}>
                {indicator.label}: {indicator.value}
              </Text>
            ))}
          </View>
          <Text style={styles.note}>
            Resultado da IA: {automaticSummary.ai_result || getCalcificationLabel(null)}
          </Text>
          <Text style={styles.note}>Presença de calcificação: {automaticSummary.calcification_presence || "N/D"}</Text>
          <Text style={styles.note}>Grau associado: {automaticSummary.grade || "N/D"}</Text>
          {automaticSummary.context_note ? <Text style={[styles.note, { marginTop: 6 }]}>{automaticSummary.context_note}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avaliação da válvula aórtica</Text>
          <Text style={styles.note}>Avaliação da válvula: {findings.valve_state || "N/D"}</Text>
          <Text style={styles.note}>Presença de calcificação: {findings.calcification_presence || "N/D"}</Text>
          <View style={{ marginTop: 8 }}>
            {renderList(findings.auto_findings)}
          </View>
          {findings.summary ? (
            <Text style={[styles.note, { marginTop: 6 }]}>
              Enquadramento clínico: {findings.summary}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medições e métricas</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.cellLabel}>Métrica</Text>
              <Text style={styles.cellValue}>Valor</Text>
            </View>
            {measurements.map((measurement, index) => (
              <View
                key={`${measurement.label}-${index}`}
                style={[
                  styles.tableRow,
                  index === measurements.length - 1 ? { borderBottom: "0 solid transparent" } : null,
                ]}
              >
                <Text style={styles.cellLabel}>{measurement.label}</Text>
                <Text style={styles.cellValue}>{measurement.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validação clínica</Text>
          <Text style={styles.note}>Estado da validação: {validation.validation_status || "Pendente"}</Text>
          <Text style={[styles.note, { marginTop: 6 }]}>
            Observações do profissional:{" "}
            {isMeaningfulClinicalText(validation.reviewer_notes)
              ? validation.reviewer_notes
              : "Sem observações adicionais."}
          </Text>
        </View>

        <View style={styles.conclusionBox}>
          <Text style={styles.sectionTitle}>Conclusão clínica</Text>
          <Text style={styles.conclusionText}>{conclusion.final_text || "Conclusão não definida."}</Text>
        </View>

        <View style={styles.footer}>
          <Text>Relatório preparado para partilha, arquivo documental e exportação PDF na plataforma CalciVision.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReportPDF;
