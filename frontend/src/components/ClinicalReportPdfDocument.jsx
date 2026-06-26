import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getClinicalReportPresentation } from "../utils/clinicalReportPresentation";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 42,
    paddingHorizontal: 34,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.38,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  header: {
    borderWidth: 1,
    borderColor: "#d6e6dd",
    backgroundColor: "#f6fbf8",
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#2f7d5d",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 9.5,
    color: "#4b5563",
    maxWidth: 350,
    marginTop: 4,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: "#c7dbd1",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusBadgeReady: {
    backgroundColor: "#eaf6ef",
    borderColor: "#cfe6d8",
  },
  statusText: {
    fontSize: 8.5,
    fontWeight: 700,
    color: "#2f7d5d",
    textTransform: "uppercase",
  },
  headerMeta: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#dce8e1",
    paddingTop: 10,
  },
  headerMetaText: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 3,
  },
  section: {
    marginBottom: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5ece8",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  sectionAlt: {
    backgroundColor: "#f9fbfa",
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#2f7d5d",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  gridItemHalf: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 8,
  },
  gridItemQuarter: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 8,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#e5ece8",
    borderRadius: 8,
    backgroundColor: "#f9fbfa",
    padding: 10,
    minHeight: 56,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 9.5,
    fontWeight: 500,
    color: "#111827",
  },
  contextNote: {
    marginTop: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d6e6dd",
    borderRadius: 8,
    backgroundColor: "#f1f8f4",
    color: "#1f513c",
    fontSize: 9,
  },
  findingCard: {
    borderWidth: 1,
    borderColor: "#e5ece8",
    borderRadius: 8,
    backgroundColor: "#f9fbfa",
    padding: 10,
    marginBottom: 8,
  },
  findingLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 4,
  },
  findingValue: {
    fontSize: 9.5,
    color: "#111827",
    lineHeight: 1.4,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#dce8e1",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#eef5f1",
    borderBottomWidth: 1,
    borderBottomColor: "#dce8e1",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2ef",
  },
  tableRowAlt: {
    backgroundColor: "#fafcfb",
  },
  cellMetric: {
    width: "27%",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cellValue: {
    width: "13%",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cellUnit: {
    width: "15%",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cellInterpretation: {
    width: "45%",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeadText: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#2f7d5d",
  },
  tableCellText: {
    fontSize: 9,
    color: "#111827",
    lineHeight: 1.35,
  },
  tableCellMuted: {
    fontSize: 8.8,
    color: "#4b5563",
    lineHeight: 1.35,
  },
  textPanel: {
    borderWidth: 1,
    borderColor: "#e5ece8",
    borderRadius: 8,
    backgroundColor: "#f9fbfa",
    padding: 10,
    marginBottom: 8,
  },
  textPanelAlt: {
    backgroundColor: "#f1f8f4",
    borderColor: "#d6e6dd",
  },
  textPanelTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 9.5,
    color: "#111827",
    lineHeight: 1.45,
    marginBottom: 3,
  },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 34,
    fontSize: 8,
    color: "#6b7280",
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 18,
    fontSize: 8,
    color: "#6b7280",
  },
});

function formatDateTime(value) {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "N/D";
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function textLines(value) {
  return String(value || "—")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function InfoGrid({ items = [], columns = "half" }) {
  const itemStyle = columns === "quarter" ? styles.gridItemQuarter : styles.gridItemHalf;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={`${item.label}-${item.value}`} style={itemStyle}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value || "—"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function FindingsBlock({ items = [] }) {
  return (
    <View>
      {items.map((item) => (
        <View key={`${item.label}-${item.value}`} style={styles.findingCard}>
          <Text style={styles.findingLabel}>{item.label}</Text>
          <Text style={styles.findingValue}>{item.value || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function TextPanel({ title, value, alt = false }) {
  return (
    <View style={[styles.textPanel, alt ? styles.textPanelAlt : null]}>
      <Text style={styles.textPanelTitle}>{title}</Text>
      {textLines(value).map((line, index) => (
        <Text key={`${title}-${index}`} style={styles.paragraph}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function MetricsTable({ rows = [] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <View style={styles.cellMetric}>
          <Text style={styles.tableHeadText}>Métrica</Text>
        </View>
        <View style={styles.cellValue}>
          <Text style={styles.tableHeadText}>Valor</Text>
        </View>
        <View style={styles.cellUnit}>
          <Text style={styles.tableHeadText}>Unidade</Text>
        </View>
        <View style={styles.cellInterpretation}>
          <Text style={styles.tableHeadText}>Interpretação</Text>
        </View>
      </View>

      {rows.length > 0 ? (
        rows.map((row, index) => (
          <View
            key={`${row.label}-${row.value}-${index}`}
            style={[styles.tableRow, index % 2 === 0 ? styles.tableRowAlt : null]}
          >
            <View style={styles.cellMetric}>
              <Text style={styles.tableCellText}>{row.label || "—"}</Text>
            </View>
            <View style={styles.cellValue}>
              <Text style={styles.tableCellText}>{row.value || "—"}</Text>
            </View>
            <View style={styles.cellUnit}>
              <Text style={styles.tableCellMuted}>{row.unit || "—"}</Text>
            </View>
            <View style={styles.cellInterpretation}>
              <Text style={styles.tableCellMuted}>
                {row.interpretation || "Sem observação adicional."}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.tableRow}>
          <View style={[styles.cellMetric, { width: "100%" }]}>
            <Text style={styles.tableCellMuted}>Não existem métricas estruturadas disponíveis.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Section({ eyebrow, title, children, alt = false, titleMinPresenceAhead = 120 }) {
  return (
    <View style={[styles.section, alt ? styles.sectionAlt : null]}>
      <View wrap={false} minPresenceAhead={titleMinPresenceAhead}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function ClinicalReportPdfDocument({ report }) {
  const presentation = getClinicalReportPresentation(report);
  const identification = presentation.identification;
  const summary = presentation.summary;
  const findings = presentation.findings;
  const metrics = presentation.metrics;
  const validation = presentation.validation;
  const conclusion = presentation.conclusion;

  const identificationItems = identification.items || [];
  const summaryCards = [
    { label: "Resultado da IA", value: summary.ai_result || "—" },
    { label: "Calcificação", value: summary.calcification_presence || "—" },
    { label: "Classificação", value: summary.classification || "—" },
    { label: "Risco estimado", value: summary.risk || "—" },
  ];

  const doctorName =
    report?.doctor?.first_name || report?.doctor?.last_name
      ? `${report.doctor.first_name || ""} ${report.doctor.last_name || ""}`.trim()
      : report?.doctor?.username || "N/D";

  return (
    <Document title={report?.download_filename || "Relatório clínico"}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} wrap={false}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.brand}>CalciVision</Text>
              <Text style={styles.title}>Relatório clínico</Text>
              <Text style={styles.subtitle}>
                Documento clínico estruturado para revisão, arquivo, partilha e integração.
              </Text>
            </View>

            <View style={[styles.statusBadge, report?.status === "READY" ? styles.statusBadgeReady : null]}>
              <Text style={styles.statusText}>
                {report?.status === "READY" ? "Validado" : "Por validar"}
              </Text>
            </View>
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.headerMetaText}>
              Data de geração: {formatDateTime(report?.created_at || report?.updated_at)}
            </Text>
            <Text style={styles.headerMetaText}>
              Última atualização: {formatDateTime(report?.updated_at)}
            </Text>
            <Text style={styles.headerMetaText}>Médico responsável: {doctorName}</Text>
          </View>
        </View>

        <Section eyebrow="Secção 1" title={identification.title || "Identificação do paciente"}>
          <InfoGrid items={identificationItems} columns="half" />
        </Section>

        <Section eyebrow="Secção 2" title={summary.title || "Resultado da análise"} alt>
          <InfoGrid items={summaryCards} columns="quarter" />
          <View style={styles.contextNote}>
            <Text>
              {summary.context_note ||
                "Resultado automático assistido por inteligência artificial, sujeito a interpretação clínica e validação do profissional responsável."}
            </Text>
          </View>
        </Section>

        <Section eyebrow="Secção 3" title="Avaliação da válvula aórtica">
          <FindingsBlock items={findings.items || []} />
        </Section>

        <Section eyebrow="Secção 4" title={metrics.title || "Métricas"} alt>
          <MetricsTable rows={metrics.rows || []} />
        </Section>

        <Section
          eyebrow="Secção 5"
          title="Validação clínica"
        >
          <TextPanel
            title="Estado de validação"
            value={validation.status || "Pendente de validação"}
            alt
          />
          <TextPanel
            title="Observações do profissional"
            value={validation.professional_notes}
          />
        </Section>

        <Section eyebrow="Secção 6" title={conclusion.title || "Conclusão clínica"} alt>
          <TextPanel
            title="Conclusão clínica final"
            value={conclusion.final_text}
            alt
          />
        </Section>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber}/${totalPages}`}
          fixed
        />
        <Text style={styles.footer} fixed>
          Exame: {report?.exam_description || "N/D"} · Data do exame: {formatDateOnly(report?.exam_date)}
        </Text>
      </Page>
    </Document>
  );
}
