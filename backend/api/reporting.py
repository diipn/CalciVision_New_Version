from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from datetime import datetime
from typing import Iterable

from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from .utils import aggregate_objective_variable_metrics, quantify_objective_variable


REPORT_SCHEMA_VERSION = 1
CALCIFICATION_THRESHOLD = 30.0
SEVERITY_THRESHOLD = 60.0
LEGACY_REPORT_TABLE = "api_reportpdf"

PDF_PAGE_WIDTH = 1240
PDF_PAGE_HEIGHT = 1754
PDF_MARGIN_X = 90
PDF_MARGIN_Y = 90
PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - (PDF_MARGIN_X * 2)
PDF_FOOTER_SPACE = 110
PDF_SECTION_GAP = 28
PDF_LINE_GAP = 8
PDF_TABLE_ROW_HEIGHT = 40

COLOR_TEXT = "#153126"
COLOR_MUTED = "#4E6C61"
COLOR_BORDER = "#D6E6DD"
COLOR_PANEL = "#F6FBF8"
COLOR_PANEL_ALT = "#ECF5F0"
COLOR_PAGE_BG = "#FAFCFB"
COLOR_HEADER = "#D9EEE2"
COLOR_TABLE_HEADER = "#EAF4EF"
COLOR_TABLE_STRIPE = "#FDFEFD"
COLOR_ACCENT = "#2F7D5D"
COLOR_BADGE = "#EAF6EF"
COLOR_SUCCESS = "#1F6A4D"

FONT_REGULAR_CANDIDATES = [
    "Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
FONT_BOLD_CANDIDATES = [
    "Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _load_font(size: int, bold: bool = False):
    candidates = FONT_BOLD_CANDIDATES if bold else FONT_REGULAR_CANDIDATES
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _now():
    try:
        return timezone.now()
    except ImproperlyConfigured:
        return datetime.now()


def _has_required_table_columns(table_name: str, required_columns: set[str]) -> bool:
    try:
        table_names = connection.introspection.table_names()
        if table_name not in table_names:
            return False

        with connection.cursor() as cursor:
            available_columns = {
                column.name
                for column in connection.introspection.get_table_description(cursor, table_name)
            }

        return required_columns.issubset(available_columns)
    except (OperationalError, ProgrammingError, ImproperlyConfigured):
        return False


def is_clinical_report_schema_ready():
    return _has_required_table_columns(
        "api_clinicalreport",
        {
            "id",
            "patient_id",
            "doctor_id",
            "echocardiogram_id",
            "status",
            "content",
            "source_snapshot",
            "validated_summary",
            "clinical_notes",
            "clinical_conclusion",
            "generation_error",
            "pdf_file",
            "created_at",
            "updated_at",
            "validated_at",
            "pdf_generated_at",
        },
    )


def is_legacy_report_schema_ready():
    return _has_required_table_columns(
        LEGACY_REPORT_TABLE,
        {
            "id",
            "patient_id",
            "doctor_id",
            "pdf_file",
        },
    )


@dataclass
class TransientClinicalReport:
    id: int | None
    patient: object
    doctor: object
    echocardiogram: object | None
    status: str
    content: dict
    source_snapshot: dict
    validated_summary: str
    clinical_notes: str
    clinical_conclusion: str
    generation_error: str = ""
    pdf_storage_name: str = ""
    pdf_size_kb: float = 0
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    validated_at: datetime | None = None
    pdf_generated_at: datetime | None = None

    @property
    def patient_id(self):
        return getattr(self.patient, "id", None)

    @property
    def echocardiogram_id(self):
        return getattr(self.echocardiogram, "id", None)

    @property
    def pdf_file(self):
        return self.pdf_storage_name or None

    @property
    def pdf_name(self):
        if not self.pdf_storage_name:
            return ""
        return str(self.pdf_storage_name).split("/")[-1]

    @property
    def pdf_size(self):
        return self.pdf_size_kb


def _is_report_ready(report) -> bool:
    return getattr(report, "status", None) == "READY"


def _normalize_echo_vo_for_report(vo_value: float | None) -> float | None:
    if vo_value is None:
        return None
    return vo_value * 100 if vo_value <= 1 else vo_value


def _draw_wrapped_text(draw: ImageDraw.ImageDraw, text: str, font, x: int, y: int, max_width: int, fill=COLOR_TEXT):
    lines = wrap_text(draw, text or "—", font, max_width)
    line_height = _line_height(font)

    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height

    return y


def _line_height(font) -> int:
    sample = font.getbbox("Ag")
    return max(sample[3] - sample[1], 16) + PDF_LINE_GAP


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    paragraphs = (text or "—").splitlines() or ["—"]
    wrapped_lines: list[str] = []

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            wrapped_lines.append("")
            continue

        current_line = words[0]
        for word in words[1:]:
            candidate = f"{current_line} {word}".strip()
            if draw.textlength(candidate, font=font) <= max_width:
                current_line = candidate
            else:
                wrapped_lines.append(current_line)
                current_line = word
        wrapped_lines.append(current_line)

    return wrapped_lines or ["—"]


def _format_display_date(value) -> str:
    if not value:
        return "N/D"
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _format_percentage(value: float | None, precision: int = 1) -> str:
    if value is None:
        return "N/D"
    return f"{value:.{precision}f}%"


def _build_frame_results_from_storage(echocardiogram, doctor):
    frames = list(echocardiogram.frames.all().order_by("frame_index").prefetch_related("data"))
    results = []

    for frame in frames:
        stored = next((item for item in frame.data.all() if item.doctor_id == doctor.id), None)
        rects = []
        if stored:
            rects.append(
                {
                    "id": f"stored-{frame.id}",
                    "x": stored.x,
                    "y": stored.y,
                    "width": stored.width,
                    "height": stored.height,
                    "is_annotation_generated": bool(stored.is_annotation_generated),
                }
            )

        results.append(
            {
                "frame_id": frame.id,
                "rects": rects,
                "is_calcified": stored.is_calcified if stored else None,
                "generated_calcium": stored.is_calcification_generated if stored else None,
            }
        )

    return results


def _extract_primary_rect(rects: Iterable[dict]) -> dict | None:
    rects = list(rects or [])
    if not rects:
        return None
    rect = rects[0]
    return {
        "x": rect.get("x"),
        "y": rect.get("y"),
        "width": rect.get("width"),
        "height": rect.get("height"),
        "is_annotation_generated": bool(rect.get("is_annotation_generated")),
    }


def frame_results_have_valid_roi(frame_results: list[dict] | None) -> bool:
    for frame_result in frame_results or []:
        if _extract_primary_rect(frame_result.get("rects")) is not None:
            return True
    return False


def _summarise_severity(vo_percentage: float | None) -> str:
    if vo_percentage is None:
        return "Indeterminada"
    if vo_percentage >= SEVERITY_THRESHOLD:
        return "Elevada"
    if vo_percentage >= CALCIFICATION_THRESHOLD:
        return "Moderada"
    return "Baixa"


def _summarise_risk(vo_percentage: float | None) -> str:
    if vo_percentage is None:
        return "Indeterminado"
    if vo_percentage >= SEVERITY_THRESHOLD:
        return "Alto"
    if vo_percentage >= CALCIFICATION_THRESHOLD:
        return "Intermédio"
    return "Baixo"


def _build_auto_conclusion(calcification_present: bool | None, severity: str, vo_percentage: float | None, calcified_frames: int, annotated_frames: int) -> str:
    if calcification_present is None:
        return (
            "Os dados atuais não permitem formular uma conclusão clínica robusta. "
            "Reveja a ROI, confirme a classificação final e valide manualmente o relatório."
        )

    if calcification_present:
        return (
            "A análise selecionada sugere presença de calcificação valvular aórtica, "
            f"com gravidade {severity.lower()} e índice de calcificação de {_format_percentage(vo_percentage)}. "
            f"Foram identificados sinais compatíveis em {calcified_frames}/{annotated_frames or 0} frames com ROI válida. "
            "Correlacionar com a restante avaliação ecocardiográfica e contexto clínico."
        )

    return (
        "A análise selecionada não identificou sinais relevantes de calcificação valvular aórtica no conjunto revisto, "
        f"com índice de calcificação de {_format_percentage(vo_percentage)}. "
        "A decisão final deve ser integrada com a avaliação clínica e restante exame."
    )


def build_clinical_report_payload(
    *,
    patient,
    echocardiogram,
    doctor,
    frame_results: list[dict] | None = None,
    classification_choice: bool | None = None,
    validated_summary: str = "",
    clinical_notes: str = "",
    clinical_conclusion: str = "",
):
    frame_results = frame_results or _build_frame_results_from_storage(echocardiogram, doctor)

    if not frame_results:
        raise ValueError("Não existem dados de análise suficientes para gerar o relatório.")

    frame_map = {
        frame.id: frame
        for frame in echocardiogram.frames.all().order_by("frame_index")
    }

    objective_metrics = []
    annotated_frames = 0
    calcified_frames = 0

    for frame_result in frame_results:
        frame = frame_map.get(frame_result["frame_id"])
        if frame is None:
            continue

        primary_rect = _extract_primary_rect(frame_result.get("rects"))
        if primary_rect is None:
            continue

        annotated_frames += 1
        if frame_result.get("is_calcified") is True:
            calcified_frames += 1

        metrics = quantify_objective_variable(frame.image.path, primary_rect)
        if metrics is None:
            continue

        objective_metrics.append(metrics)

    summary = aggregate_objective_variable_metrics(objective_metrics)
    total_frames = echocardiogram.frames.count()
    vo_percentage = summary["vo_percentage"] if summary else None
    inferred_calcification = None

    if classification_choice is not None:
        calcification_present = classification_choice
        classification_source = "validated_by_user"
    elif annotated_frames > 0:
        inferred_calcification = bool(calcified_frames > 0 or (vo_percentage is not None and vo_percentage >= CALCIFICATION_THRESHOLD))
        calcification_present = inferred_calcification
        classification_source = "automatic_inference"
    else:
        calcification_present = None
        classification_source = "unavailable"

    classification_label = (
        "Calcificação presente"
        if calcification_present is True
        else "Sem calcificação relevante"
        if calcification_present is False
        else "Classificação pendente"
    )
    calcification_presence = (
        "Presente" if calcification_present is True else "Ausente" if calcification_present is False else "Indeterminada"
    )
    severity = _summarise_severity(vo_percentage)
    risk = _summarise_risk(vo_percentage)
    calcification_ratio = round((calcified_frames / annotated_frames) * 100, 1) if annotated_frames else None
    exam_date = echocardiogram.uploaded_at.date() if echocardiogram.uploaded_at else None
    exam_label = echocardiogram.description or f"Ecocardiograma #{echocardiogram.id}"
    auto_conclusion = _build_auto_conclusion(
        calcification_present,
        severity,
        vo_percentage,
        calcified_frames,
        annotated_frames,
    )

    content = {
        "identification": {
            "title": "Identificação do paciente e do exame",
            "items": [
                {"label": "Nome do paciente", "value": patient.name or "N/D"},
                {"label": "Identificador", "value": str(patient.id)},
                {"label": "Data do exame", "value": _format_display_date(exam_date)},
                {"label": "Exame selecionado", "value": exam_label},
                {"label": "Tipo / modalidade", "value": "Ecocardiograma"},
            ],
        },
        "summary": {
            "title": "Resumo automático da análise",
            "ai_result": classification_label,
            "calcification_presence": calcification_presence,
            "classification": severity,
            "context_note": (
                "Resultado gerado automaticamente a partir da análise selecionada. "
                "Requer validação clínica antes de partilha ou arquivo."
            ),
            "highlights": [
                {"label": "Frames totais", "value": str(total_frames)},
                {"label": "Frames com ROI válida", "value": str(annotated_frames)},
                {"label": "Frames com calcificação", "value": str(calcified_frames)},
                {"label": "Índice de calcificação", "value": _format_percentage(vo_percentage)},
                {"label": "Risco estimado", "value": risk},
            ],
        },
        "findings": {
            "title": "Achados / observações da válvula",
            "items": [
                {
                    "label": "Estado da válvula",
                    "value": (
                        "Achados compatíveis com alteração valvular calcificada."
                        if calcification_present is True
                        else "Sem sinais relevantes de alteração calcificada na avaliação analisada."
                        if calcification_present is False
                        else "Avaliação insuficiente para caracterização definitiva da válvula."
                    ),
                },
                {
                    "label": "Presença de calcificação",
                    "value": (
                        f"{calcification_presence} em {calcified_frames} de {annotated_frames or 0} frames com ROI válida."
                        if annotated_frames
                        else "Sem ROI válida suficiente para quantificação."
                    ),
                },
                {
                    "label": "Observações relevantes",
                    "value": (
                        "Interpretar em conjunto com a revisão médica, restantes achados ecocardiográficos "
                        "e qualidade da janela acústica."
                    ),
                },
            ],
        },
        "metrics": {
            "title": "Medições / métricas",
            "rows": [
                {
                    "label": "Índice de calcificação (VO)",
                    "value": f"{vo_percentage:.1f}" if vo_percentage is not None else "N/D",
                    "unit": "%",
                    "interpretation": (
                        f"Gravidade {severity.lower()} com risco {risk.lower()}."
                        if vo_percentage is not None
                        else "Quantificação indisponível."
                    ),
                },
                {
                    "label": "Frames totais analisados",
                    "value": str(total_frames),
                    "unit": "frames",
                    "interpretation": "Total de frames disponibilizados pelo exame selecionado.",
                },
                {
                    "label": "Frames com ROI válida",
                    "value": str(annotated_frames),
                    "unit": "frames",
                    "interpretation": "Frames com anotação suficiente para suportar a quantificação.",
                },
                {
                    "label": "Frames com calcificação",
                    "value": str(calcified_frames),
                    "unit": "frames",
                    "interpretation": "Frames classificados com achados compatíveis com calcificação.",
                },
                {
                    "label": "Percentagem de frames calcificados",
                    "value": f"{calcification_ratio:.1f}" if calcification_ratio is not None else "N/D",
                    "unit": "%",
                    "interpretation": "Proporção de frames calcificados entre os frames com ROI válida.",
                },
                {
                    "label": "Pixels brancos",
                    "value": str(summary["white_pixel_count"]) if summary else "N/D",
                    "unit": "pixels",
                    "interpretation": "Pixels acima do limiar alto dentro da ROI.",
                },
                {
                    "label": "Pixels cinzentos",
                    "value": str(summary["gray_pixel_count"]) if summary else "N/D",
                    "unit": "pixels",
                    "interpretation": "Pixels intermédios ponderados na fórmula da VO.",
                },
                {
                    "label": "Pixels válidos na ROI",
                    "value": str(summary["valid_pixel_count"]) if summary else "N/D",
                    "unit": "pixels",
                    "interpretation": "Base total de pixels considerados na região anotada.",
                },
            ],
        },
        "validation": {
            "title": "Validação e edição pelo utilizador",
            "status": "Validado" if clinical_conclusion.strip() else "Pendente de validação",
            "generated_note": (
                "As secções acima foram geradas automaticamente. "
                "Os campos abaixo refletem validação, complemento ou correção manual."
            ),
        },
        "conclusion": {
            "title": "Conclusão clínica",
            "suggested_text": auto_conclusion,
        },
    }

    snapshot = {
        "schema_version": REPORT_SCHEMA_VERSION,
        "patient_id": patient.id,
        "echocardiogram_id": echocardiogram.id,
        "classification_choice": classification_choice,
        "classification_source": classification_source,
        "calcification_present": calcification_present,
        "objective_variable_percentage": vo_percentage,
        "annotated_frames": annotated_frames,
        "calcified_frames": calcified_frames,
        "calcified_frame_percentage": calcification_ratio,
        "total_frames": total_frames,
        "generated_at": _now().isoformat(),
    }

    if not validated_summary.strip():
        validated_summary = (
            f"{classification_label}. Índice de calcificação {_format_percentage(vo_percentage)} "
            f"e {calcified_frames} frames compatíveis com calcificação."
            if calcification_present is not None and annotated_frames
            else "Síntese pendente de validação manual."
        )

    if not clinical_conclusion.strip():
        clinical_conclusion = auto_conclusion

    manual_fields = {
        "validated_summary": validated_summary.strip(),
        "clinical_notes": clinical_notes.strip(),
        "clinical_conclusion": clinical_conclusion.strip(),
    }

    return content, snapshot, manual_fields


def validate_clinical_report_data(report) -> list[str]:
    issues: list[str] = []

    if report.echocardiogram_id is None:
        issues.append("O relatório não está associado a um exame específico.")

    content = report.content or {}
    for section_key, section_label in (
        ("identification", "identificação do paciente e do exame"),
        ("summary", "resumo automático da análise"),
        ("findings", "achados da válvula"),
        ("metrics", "métricas"),
    ):
        if not content.get(section_key):
            issues.append(f"Falta a secção de {section_label}.")

    if not report.validated_summary.strip():
        issues.append("A síntese validada pelo utilizador ainda não foi preenchida.")

    if not report.clinical_conclusion.strip():
        issues.append("A conclusão clínica final ainda não foi preenchida.")

    if not report.source_snapshot.get("annotated_frames"):
        issues.append("Não existem frames com ROI válida suficientes para suportar o relatório.")

    return issues


def build_report_filename(report) -> str:
    patient_slug = slugify(report.patient.name or f"paciente-{report.patient_id}") or f"paciente-{report.patient_id}"
    echocardiogram = getattr(report, "echocardiogram", None)
    exam_slug = slugify(
        (getattr(echocardiogram, "description", None) if report.echocardiogram_id else None)
        or f"exame-{report.echocardiogram_id or report.id}"
    ) or f"exame-{report.echocardiogram_id or report.id}"
    exam_uploaded_at = getattr(echocardiogram, "uploaded_at", None)
    exam_date = exam_uploaded_at.date().isoformat() if exam_uploaded_at else _now().date().isoformat()
    return f"relatorio_clinico_{patient_slug}_{exam_slug}_{exam_date}.pdf"


def build_transient_clinical_report(
    *,
    patient,
    doctor,
    echocardiogram,
    content: dict,
    source_snapshot: dict,
    validated_summary: str,
    clinical_notes: str,
    clinical_conclusion: str,
    status: str,
    report_id: int | None = None,
    pdf_storage_name: str = "",
    pdf_size_kb: float = 0,
    generation_error: str = "",
    validated_at=None,
    pdf_generated_at=None,
):
    timestamp = _now()
    return TransientClinicalReport(
        id=report_id,
        patient=patient,
        doctor=doctor,
        echocardiogram=echocardiogram,
        status=status,
        content=content,
        source_snapshot=source_snapshot,
        validated_summary=validated_summary,
        clinical_notes=clinical_notes,
        clinical_conclusion=clinical_conclusion,
        generation_error=generation_error,
        pdf_storage_name=pdf_storage_name,
        pdf_size_kb=pdf_size_kb,
        created_at=timestamp,
        updated_at=timestamp,
        validated_at=validated_at,
        pdf_generated_at=pdf_generated_at,
    )


def get_latest_legacy_report_record(*, patient_id: int, doctor_id: int):
    if not is_legacy_report_schema_ready():
        return None

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id, patient_id, doctor_id, pdf_file
            FROM {LEGACY_REPORT_TABLE}
            WHERE patient_id = %s AND doctor_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            [patient_id, doctor_id],
        )
        row = cursor.fetchone()

    if not row:
        return None

    report_id, row_patient_id, row_doctor_id, pdf_file = row
    pdf_size_bytes = 0
    if pdf_file and default_storage.exists(pdf_file):
        try:
            pdf_size_bytes = default_storage.size(pdf_file)
        except OSError:
            pdf_size_bytes = 0

    return {
        "id": report_id,
        "patient_id": row_patient_id,
        "doctor_id": row_doctor_id,
        "pdf_file": pdf_file,
        "pdf_size_kb": round(pdf_size_bytes / 1024, 2) if pdf_size_bytes else 0,
    }


def list_legacy_report_records(*, doctor_id: int, patient_id: int | None = None):
    if not is_legacy_report_schema_ready():
        return []

    query = f"""
        SELECT id, patient_id, doctor_id, pdf_file
        FROM {LEGACY_REPORT_TABLE}
        WHERE doctor_id = %s
    """
    params: list[object] = [doctor_id]
    if patient_id is not None:
        query += " AND patient_id = %s"
        params.append(patient_id)
    query += " ORDER BY id DESC"

    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()

    records = []
    for report_id, row_patient_id, row_doctor_id, pdf_file in rows:
        pdf_size_bytes = 0
        if pdf_file and default_storage.exists(pdf_file):
            try:
                pdf_size_bytes = default_storage.size(pdf_file)
            except OSError:
                pdf_size_bytes = 0
        records.append(
            {
                "id": report_id,
                "patient_id": row_patient_id,
                "doctor_id": row_doctor_id,
                "pdf_file": pdf_file,
                "pdf_size_kb": round(pdf_size_bytes / 1024, 2) if pdf_size_bytes else 0,
            }
        )

    return records


def replace_legacy_report_pdf(*, patient_id: int, doctor_id: int, filename: str, pdf_bytes: bytes):
    if not is_legacy_report_schema_ready():
        raise ValueError("A tabela legada de relatórios não está disponível.")

    existing = list_legacy_report_records(doctor_id=doctor_id, patient_id=patient_id)
    for record in existing:
        pdf_file = record.get("pdf_file")
        if pdf_file and default_storage.exists(pdf_file):
            default_storage.delete(pdf_file)

    with connection.cursor() as cursor:
        cursor.execute(
            f"DELETE FROM {LEGACY_REPORT_TABLE} WHERE patient_id = %s AND doctor_id = %s",
            [patient_id, doctor_id],
        )

    storage_name = default_storage.save(f"reports/{filename}", ContentFile(pdf_bytes))
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO {LEGACY_REPORT_TABLE} (patient_id, doctor_id, pdf_file)
            VALUES (%s, %s, %s)
            """,
            [patient_id, doctor_id, storage_name],
        )
        report_id = cursor.lastrowid

    return {
        "id": report_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "pdf_file": storage_name,
        "pdf_size_kb": round(len(pdf_bytes) / 1024, 2),
    }


def delete_legacy_report_record(*, report_id: int, doctor_id: int):
    if not is_legacy_report_schema_ready():
        return False

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT pdf_file
            FROM {LEGACY_REPORT_TABLE}
            WHERE id = %s AND doctor_id = %s
            """,
            [report_id, doctor_id],
        )
        row = cursor.fetchone()

    if not row:
        return False

    pdf_file = row[0]
    if pdf_file and default_storage.exists(pdf_file):
        default_storage.delete(pdf_file)

    with connection.cursor() as cursor:
        cursor.execute(
            f"DELETE FROM {LEGACY_REPORT_TABLE} WHERE id = %s AND doctor_id = %s",
            [report_id, doctor_id],
        )

    return True


def read_legacy_report_pdf(*, report_id: int, doctor_id: int):
    if not is_legacy_report_schema_ready():
        return None

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id, patient_id, doctor_id, pdf_file
            FROM {LEGACY_REPORT_TABLE}
            WHERE id = %s AND doctor_id = %s
            LIMIT 1
            """,
            [report_id, doctor_id],
        )
        row = cursor.fetchone()

    if not row:
        return None

    report_id, patient_id, doctor_id, pdf_file = row
    if not pdf_file or not default_storage.exists(pdf_file):
        return {
            "id": report_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "pdf_file": pdf_file,
            "filename": pdf_file.split("/")[-1] if pdf_file else f"relatorio_{report_id}.pdf",
            "pdf_bytes": b"",
        }

    with default_storage.open(pdf_file, "rb") as file_handle:
        pdf_bytes = file_handle.read()

    return {
        "id": report_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "pdf_file": pdf_file,
        "filename": pdf_file.split("/")[-1],
        "pdf_bytes": pdf_bytes,
    }


def infer_legacy_report_echocardiogram(record: dict, patient, echocardiograms=None):
    echocardiograms = list(echocardiograms or patient.echocardiograms.all())
    if not echocardiograms:
        return None

    filename = (record.get("filename") or record.get("pdf_file") or "").split("/")[-1]
    patient_slug = slugify(patient.name or f"paciente-{patient.id}") or f"paciente-{patient.id}"
    prefix = f"relatorio_clinico_{patient_slug}_"

    inferred_slug = None
    inferred_date = None
    if filename.startswith(prefix) and filename.lower().endswith(".pdf"):
        stem = filename[:-4]
        tail = stem[len(prefix):]
        if "_" in tail:
            inferred_slug, inferred_date = tail.rsplit("_", 1)

    dated_matches = []
    slug_matches = []
    for echocardiogram in echocardiograms:
        echo_slug = slugify(echocardiogram.description or f"exame-{echocardiogram.id}") or f"exame-{echocardiogram.id}"
        echo_date = echocardiogram.uploaded_at.date().isoformat() if echocardiogram.uploaded_at else None
        if inferred_slug and echo_slug == inferred_slug:
            slug_matches.append(echocardiogram)
            if inferred_date and echo_date == inferred_date:
                dated_matches.append(echocardiogram)

    if dated_matches:
        return sorted(dated_matches, key=lambda item: (item.uploaded_at or _now(), item.id), reverse=True)[0]
    if slug_matches:
        return sorted(slug_matches, key=lambda item: (item.uploaded_at or _now(), item.id), reverse=True)[0]

    return sorted(echocardiograms, key=lambda item: (item.uploaded_at or _now(), item.id), reverse=True)[0]


def build_legacy_patient_reports(*, patient, doctor, records: list[dict], echocardiograms=None):
    echocardiograms = list(echocardiograms or patient.echocardiograms.all())
    reports = []

    for record in records:
        echocardiogram = infer_legacy_report_echocardiogram(record, patient, echocardiograms)
        normalized_vo = _normalize_echo_vo_for_report(getattr(echocardiogram, "vo", None)) if echocardiogram else None
        reports.append(
            build_transient_clinical_report(
                patient=patient,
                doctor=doctor,
                echocardiogram=echocardiogram,
                content={},
                source_snapshot={
                    "calcification_present": (
                        normalized_vo >= CALCIFICATION_THRESHOLD if normalized_vo is not None else None
                    ),
                },
                validated_summary='',
                clinical_notes='',
                clinical_conclusion='',
                status='READY',
                report_id=record['id'],
                pdf_storage_name=record.get('pdf_file', ''),
                pdf_size_kb=record.get('pdf_size_kb', 0),
                validated_at=_now(),
                pdf_generated_at=_now(),
            )
        )

    return reports


def _create_new_page():
    image = Image.new("RGB", (PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT), COLOR_PAGE_BG)
    draw = ImageDraw.Draw(image)
    return image, draw


def _render_key_value_block(draw, x: int, y: int, width: int, label: str, value: str, label_font, value_font):
    label_width = int(width * 0.34)
    value_width = width - label_width - 20
    line_height = _line_height(value_font)
    label_lines = wrap_text(draw, label, label_font, label_width)
    value_lines = wrap_text(draw, value, value_font, value_width)
    block_height = max(len(label_lines), len(value_lines)) * line_height + 6

    current_y = y
    for index, line in enumerate(label_lines):
        draw.text((x, current_y + (index * line_height)), line, font=label_font, fill=COLOR_MUTED)
    for index, line in enumerate(value_lines):
        draw.text((x + label_width + 20, current_y + (index * line_height)), line, font=value_font, fill=COLOR_TEXT)

    return y + block_height


def _measure_wrapped_height(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> int:
    return max(len(wrap_text(draw, text or "—", font, max_width)), 1) * _line_height(font)


def _draw_card(draw: ImageDraw.ImageDraw, box: list[int], fill: str, outline: str = COLOR_BORDER, accent: str | None = None):
    draw.rounded_rectangle(box, radius=24, fill=fill, outline=outline, width=2)
    if accent:
        draw.rounded_rectangle(
            [box[0] + 10, box[1] + 10, box[0] + 22, box[3] - 10],
            radius=8,
            fill=accent,
        )


def render_clinical_report_pdf(report):
    content = report.content or {}
    issues = validate_clinical_report_data(report)
    if issues:
        raise ValueError("Relatório incompleto: " + " ".join(issues))

    regular_font = _load_font(19)
    small_font = _load_font(15)
    label_font = _load_font(15, bold=True)
    bold_font = _load_font(19, bold=True)
    stat_value_font = _load_font(22, bold=True)
    title_font = _load_font(38, bold=True)
    section_font = _load_font(24, bold=True)
    footer_font = _load_font(14)

    pages = []
    image, draw = _create_new_page()
    pages.append(image)
    y = PDF_MARGIN_Y

    def ensure_space(required_height: int):
        nonlocal image, draw, y
        if y + required_height <= PDF_PAGE_HEIGHT - PDF_MARGIN_Y - PDF_FOOTER_SPACE:
            return
        image, draw = _create_new_page()
        pages.append(image)
        y = PDF_MARGIN_Y

    def draw_section(title: str, eyebrow: str | None = None):
        nonlocal y
        ensure_space(84)
        if eyebrow:
            draw.text((PDF_MARGIN_X, y), eyebrow.upper(), font=small_font, fill=COLOR_MUTED)
            y += 24
        draw.text((PDF_MARGIN_X, y), title, font=section_font, fill=COLOR_ACCENT)
        draw.line(
            [(PDF_MARGIN_X, y + 42), (PDF_PAGE_WIDTH - PDF_MARGIN_X, y + 42)],
            fill=COLOR_BORDER,
            width=2,
        )
        y += 62

    def draw_key_value_card(text_lines: list[tuple[str, str]], *, fill: str = COLOR_PANEL, accent: str | None = COLOR_ACCENT):
        nonlocal y
        line_height = _line_height(regular_font)
        estimated_height = 36
        for label, value in text_lines:
            estimated_height += max(
                len(wrap_text(draw, label, label_font, int(PDF_CONTENT_WIDTH * 0.34))),
                len(wrap_text(draw, value, regular_font, int(PDF_CONTENT_WIDTH * 0.6))),
            ) * line_height + 8
        estimated_height += 24

        ensure_space(estimated_height)
        _draw_card(
            draw,
            [PDF_MARGIN_X, y, PDF_PAGE_WIDTH - PDF_MARGIN_X, y + estimated_height],
            fill=fill,
            accent=accent,
        )
        current_y = y + 24
        for label, value in text_lines:
            current_y = _render_key_value_block(
                draw,
                PDF_MARGIN_X + 34,
                current_y,
                PDF_CONTENT_WIDTH - 68,
                label,
                value,
                label_font,
                regular_font,
            )
            current_y += 8
        y += estimated_height + PDF_SECTION_GAP

    def draw_tile_grid(items: list[dict], *, columns: int = 2, fill: str = "white", accent: str | None = None, value_font=None):
        nonlocal y
        if not items:
            return

        value_font = value_font or regular_font
        gap = 22
        column_width = int((PDF_CONTENT_WIDTH - (gap * (columns - 1))) / columns)
        index = 0

        while index < len(items):
            row_items = items[index:index + columns]
            row_heights = []
            for item in row_items:
                note_height = _measure_wrapped_height(draw, item.get("note", ""), small_font, column_width - 46) if item.get("note") else 0
                height = (
                    26 +
                    _measure_wrapped_height(draw, item.get("label", "Campo"), small_font, column_width - 46) +
                    10 +
                    _measure_wrapped_height(draw, item.get("value", "—"), value_font, column_width - 46) +
                    (8 + note_height if note_height else 0) +
                    26
                )
                row_heights.append(max(height, 124))

            row_height = max(row_heights)
            ensure_space(row_height)
            x = PDF_MARGIN_X

            for tile_index, item in enumerate(row_items):
                box = [x, y, x + column_width, y + row_height]
                _draw_card(draw, box, fill=fill, accent=accent if tile_index == 0 and columns == 1 else None)
                current_y = y + 22
                draw.text((x + 22, current_y), item.get("label", "Campo").upper(), font=small_font, fill=COLOR_MUTED)
                current_y += _measure_wrapped_height(draw, item.get("label", "Campo"), small_font, column_width - 46) + 10
                current_y = _draw_wrapped_text(draw, item.get("value", "—"), value_font, x + 22, current_y, column_width - 46, fill=COLOR_TEXT)
                if item.get("note"):
                    current_y += 8
                    _draw_wrapped_text(draw, item.get("note", ""), small_font, x + 22, current_y, column_width - 46, fill=COLOR_MUTED)
                x += column_width + gap

            y += row_height + 18
            index += columns

    def draw_text_panel(title: str, body: str, *, fill: str = "white", accent: str | None = None):
        nonlocal y
        estimated_height = (
            28 +
            _measure_wrapped_height(draw, title, bold_font, PDF_CONTENT_WIDTH - 68) +
            12 +
            _measure_wrapped_height(draw, body, regular_font, PDF_CONTENT_WIDTH - 68) +
            24
        )
        ensure_space(estimated_height)
        _draw_card(
            draw,
            [PDF_MARGIN_X, y, PDF_PAGE_WIDTH - PDF_MARGIN_X, y + estimated_height],
            fill=fill,
            accent=accent,
        )
        current_y = y + 24
        draw.text((PDF_MARGIN_X + 34, current_y), title, font=bold_font, fill=COLOR_TEXT)
        current_y += _line_height(bold_font) + 6
        _draw_wrapped_text(draw, body, regular_font, PDF_MARGIN_X + 34, current_y, PDF_CONTENT_WIDTH - 68, fill=COLOR_TEXT)
        y += estimated_height + 18

    def draw_metrics_table(rows: list[dict]):
        nonlocal y
        if not rows:
            return

        processed_rows = []
        for row in rows:
            processed_rows.append(
                {
                    "label": row.get("label", "—"),
                    "value": row.get("value", "—"),
                    "unit": row.get("unit", "—"),
                    "interpretation": row.get("interpretation", "Sem observação adicional."),
                }
            )

        table_width = PDF_CONTENT_WIDTH
        inner_width = table_width - 48
        column_widths = [
            int(inner_width * 0.33),
            int(inner_width * 0.14),
            int(inner_width * 0.12),
            inner_width - int(inner_width * 0.33) - int(inner_width * 0.14) - int(inner_width * 0.12),
        ]

        header_height = 60
        row_heights = []
        for row in processed_rows:
            row_heights.append(
                max(
                    PDF_TABLE_ROW_HEIGHT + 10,
                    _measure_wrapped_height(draw, row["label"], regular_font, column_widths[0] - 12) + 20,
                    _measure_wrapped_height(draw, row["value"], regular_font, column_widths[1] - 12) + 20,
                    _measure_wrapped_height(draw, row["unit"], small_font, column_widths[2] - 12) + 20,
                    _measure_wrapped_height(draw, row["interpretation"], small_font, column_widths[3] - 12) + 20,
                )
            )

        total_height = header_height + sum(row_heights)
        ensure_space(total_height + 18)
        _draw_card(
            draw,
            [PDF_MARGIN_X, y, PDF_PAGE_WIDTH - PDF_MARGIN_X, y + total_height],
            fill="white",
            accent=COLOR_ACCENT,
        )

        draw.rounded_rectangle(
            [PDF_MARGIN_X + 12, y + 12, PDF_PAGE_WIDTH - PDF_MARGIN_X - 12, y + header_height],
            radius=16,
            fill=COLOR_TABLE_HEADER,
        )

        headers = ["Métrica", "Valor", "Un.", "Interpretação"]
        x_positions = [PDF_MARGIN_X + 24]
        for width in column_widths[:-1]:
            x_positions.append(x_positions[-1] + width)

        for index, header in enumerate(headers):
            draw.text((x_positions[index], y + 28), header, font=label_font, fill=COLOR_ACCENT)

        current_y = y + header_height
        for row_index, row in enumerate(processed_rows):
            row_height = row_heights[row_index]
            if row_index % 2 == 0:
                draw.rounded_rectangle(
                    [PDF_MARGIN_X + 12, current_y, PDF_PAGE_WIDTH - PDF_MARGIN_X - 12, current_y + row_height],
                    radius=14,
                    fill=COLOR_TABLE_STRIPE,
                )
            draw.line(
                [(PDF_MARGIN_X + 16, current_y), (PDF_PAGE_WIDTH - PDF_MARGIN_X - 16, current_y)],
                fill=COLOR_BORDER,
                width=1,
            )

            row_top = current_y + 12
            _draw_wrapped_text(draw, row["label"], regular_font, x_positions[0], row_top, column_widths[0] - 12, fill=COLOR_TEXT)
            _draw_wrapped_text(draw, row["value"], regular_font, x_positions[1], row_top, column_widths[1] - 12, fill=COLOR_TEXT)
            _draw_wrapped_text(draw, row["unit"], small_font, x_positions[2], row_top + 2, column_widths[2] - 12, fill=COLOR_MUTED)
            _draw_wrapped_text(draw, row["interpretation"], small_font, x_positions[3], row_top + 2, column_widths[3] - 12, fill=COLOR_MUTED)
            current_y += row_height

        y += total_height + 18

    identification_items = content.get("identification", {}).get("items", [])
    summary = content.get("summary", {})
    findings = content.get("findings", {})
    metrics = content.get("metrics", {})
    validation = content.get("validation", {})
    conclusion = content.get("conclusion", {})
    highlights = summary.get("highlights", [])
    identification_lookup = {
        item.get("label"): item.get("value")
        for item in identification_items
        if isinstance(item, dict)
    }

    status_label = "VALIDADO" if _is_report_ready(report) else "POR VALIDAR"
    generation_label = _format_display_date(getattr(report, "validated_at", None) or getattr(report, "updated_at", None) or _now().date())
    doctor_label = report.doctor.get_full_name() or report.doctor.username

    header_height = 184
    _draw_card(
        draw,
        [PDF_MARGIN_X, y, PDF_PAGE_WIDTH - PDF_MARGIN_X, y + header_height],
        fill=COLOR_HEADER,
        accent=COLOR_ACCENT,
    )
    draw.text((PDF_MARGIN_X + 40, y + 28), "CALCIVISION", font=small_font, fill=COLOR_ACCENT)
    draw.text((PDF_MARGIN_X + 40, y + 54), "Relatório clínico", font=title_font, fill=COLOR_TEXT)
    draw.text(
        (PDF_MARGIN_X + 40, y + 104),
        "Documento clínico estruturado para revisão, arquivo e partilha.",
        font=regular_font,
        fill=COLOR_MUTED,
    )

    badge_width = int(draw.textlength(status_label, font=label_font)) + 48
    draw.rounded_rectangle(
        [PDF_PAGE_WIDTH - PDF_MARGIN_X - badge_width - 24, y + 30, PDF_PAGE_WIDTH - PDF_MARGIN_X - 24, y + 74],
        radius=18,
        fill=COLOR_BADGE,
        outline=COLOR_BORDER,
        width=2,
    )
    draw.text(
        (PDF_PAGE_WIDTH - PDF_MARGIN_X - badge_width - 2, y + 43),
        status_label,
        font=label_font,
        fill=COLOR_SUCCESS if _is_report_ready(report) else COLOR_ACCENT,
    )

    meta_top = y + 140
    draw.text((PDF_MARGIN_X + 40, meta_top), f"Data de emissão: {generation_label}", font=label_font, fill=COLOR_TEXT)
    draw.text((PDF_MARGIN_X + 40, meta_top + 24), f"Médico responsável: {doctor_label}", font=label_font, fill=COLOR_TEXT)
    y += header_height + 34

    draw_section(content.get("identification", {}).get("title", "Identificação"), "Secção 1")
    draw_tile_grid(
        [{"label": item.get("label", "Campo"), "value": item.get("value", "—")} for item in identification_items],
        columns=2,
        fill="white",
    )

    draw_section(summary.get("title", "Resumo automático da análise"), "Secção 2")
    draw_tile_grid(
        [
            {"label": "Resultado da IA", "value": summary.get("ai_result", "—")},
            {"label": "Calcificação", "value": summary.get("calcification_presence", "—")},
            {"label": "Classificação", "value": summary.get("classification", "—")},
            {
                "label": "Risco estimado",
                "value": next((item.get("value") for item in highlights if item.get("label") == "Risco estimado"), "—"),
            },
        ],
        columns=2,
        fill=COLOR_PANEL_ALT,
        value_font=stat_value_font,
    )
    draw_text_panel(
        "Contexto clínico do resultado automático",
        summary.get("context_note", "O resultado automático deve ser interpretado no contexto clínico global."),
        fill="white",
        accent=COLOR_ACCENT,
    )
    draw_tile_grid(
        [{"label": item.get("label", "Indicador"), "value": item.get("value", "—")} for item in highlights],
        columns=3,
        fill="white",
        value_font=bold_font,
    )

    draw_section(findings.get("title", "Achados / observações da válvula"), "Secção 3")
    draw_tile_grid(
        [
            {
                "label": item.get("label", "Achado"),
                "value": item.get("value", "—"),
            }
            for item in findings.get("items", [])
        ],
        columns=1,
        fill="white",
        accent=COLOR_ACCENT,
    )

    draw_section(metrics.get("title", "Medições / métricas"), "Secção 4")
    draw_metrics_table(metrics.get("rows", []))

    draw_section(validation.get("title", "Validação e edição pelo utilizador"), "Secção 5")
    draw_key_value_card(
        [
            ("Estado de validação", "Validado" if _is_report_ready(report) else "Pendente de validação"),
            ("Origem dos campos automáticos", validation.get("generated_note", "Os campos acima foram gerados automaticamente e requerem revisão clínica.")),
        ],
        fill=COLOR_PANEL_ALT,
    )
    draw_text_panel(
        "Síntese validada pelo utilizador",
        report.validated_summary or "—",
        fill="white",
        accent=COLOR_ACCENT,
    )
    draw_text_panel(
        "Observações clínicas",
        report.clinical_notes or "—",
        fill="white",
        accent=COLOR_ACCENT,
    )

    draw_section(conclusion.get("title", "Conclusão clínica"), "Secção 6")
    draw_text_panel(
        "Conclusão clínica final",
        report.clinical_conclusion or "—",
        fill=COLOR_PANEL_ALT,
        accent=COLOR_ACCENT,
    )
    draw_text_panel(
        "Base automática para enquadramento",
        conclusion.get("suggested_text", "—"),
        fill="white",
    )

    footer_text = (
        f"Relatório associado ao exame #{report.echocardiogram_id or 'N/D'} • "
        f"Médico responsável: {doctor_label}"
    )
    total_pages = len(pages)
    for page_index, page in enumerate(pages, start=1):
        footer_draw = ImageDraw.Draw(page)
        footer_y = PDF_PAGE_HEIGHT - PDF_MARGIN_Y - 44
        footer_draw.line(
            [(PDF_MARGIN_X, footer_y), (PDF_PAGE_WIDTH - PDF_MARGIN_X, footer_y)],
            fill=COLOR_BORDER,
            width=2,
        )
        footer_draw.text(
            (PDF_MARGIN_X, footer_y + 16),
            footer_text,
            font=footer_font,
            fill=COLOR_MUTED,
        )
        page_label = f"Página {page_index}/{total_pages}"
        page_width = int(footer_draw.textlength(page_label, font=footer_font))
        footer_draw.text(
            (PDF_PAGE_WIDTH - PDF_MARGIN_X - page_width, footer_y + 16),
            page_label,
            font=footer_font,
            fill=COLOR_MUTED,
        )

    buffer = BytesIO()
    pages_rgb = [page.convert("RGB") for page in pages]
    pages_rgb[0].save(buffer, format="PDF", resolution=150.0, save_all=True, append_images=pages_rgb[1:])
    pdf_bytes = buffer.getvalue()

    if not pdf_bytes.startswith(b"%PDF"):
        raise ValueError("O conteúdo gerado não corresponde a um PDF válido.")

    return pdf_bytes


def persist_report_pdf(report):
    pdf_bytes = render_clinical_report_pdf(report)
    filename = build_report_filename(report)

    if report.pdf_file:
        report.pdf_file.delete(save=False)

    report.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
    report.pdf_generated_at = _now()
    report.generation_error = ""
    report.save(update_fields=["pdf_file", "pdf_generated_at", "generation_error", "updated_at"])
    return filename, pdf_bytes
