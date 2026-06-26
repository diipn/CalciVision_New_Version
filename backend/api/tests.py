import unittest
from dataclasses import dataclass
from datetime import datetime
import numpy as np

from api.utils import aggregate_objective_variable_metrics, quantify_objective_variable
from api.reporting import (
    TransientClinicalReport,
    _build_auto_conclusion,
    _clean_clinical_notes,
    build_report_filename,
    frame_results_have_valid_roi,
    render_clinical_report_pdf,
    validate_clinical_report_data,
)


class ObjectiveVariableUtilsTests(unittest.TestCase):
    def test_quantify_objective_variable_counts_uniform_white_roi(self):
        image = np.full((16, 16), 240, dtype=np.uint8)

        metrics = quantify_objective_variable(
            image,
            {'x': 0, 'y': 0, 'width': 16, 'height': 16},
        )

        self.assertIsNotNone(metrics)
        self.assertEqual(metrics['white_pixel_count'], 256)
        self.assertEqual(metrics['gray_pixel_count'], 0)
        self.assertEqual(metrics['valid_pixel_count'], 256)
        self.assertEqual(metrics['vo'], 1.0)

    def test_quantify_objective_variable_counts_uniform_gray_roi(self):
        image = np.full((10, 10), 160, dtype=np.uint8)

        metrics = quantify_objective_variable(
            image,
            {'x': 0, 'y': 0, 'width': 10, 'height': 10},
        )

        self.assertIsNotNone(metrics)
        self.assertEqual(metrics['white_pixel_count'], 0)
        self.assertEqual(metrics['gray_pixel_count'], 100)
        self.assertEqual(metrics['valid_pixel_count'], 100)
        self.assertEqual(metrics['vo'], 0.5)

    def test_aggregate_objective_variable_metrics_is_weighted_by_pixel_count(self):
        summary = aggregate_objective_variable_metrics([
            {
                'white_pixel_count': 40,
                'gray_pixel_count': 20,
                'valid_pixel_count': 100,
            },
            {
                'white_pixel_count': 10,
                'gray_pixel_count': 30,
                'valid_pixel_count': 50,
            },
        ])

        self.assertIsNotNone(summary)
        self.assertAlmostEqual(summary['vo'], 0.5, places=6)
        self.assertEqual(summary['white_pixel_count'], 50)
        self.assertEqual(summary['gray_pixel_count'], 50)
        self.assertEqual(summary['valid_pixel_count'], 150)
        self.assertEqual(summary['frame_count'], 2)


@dataclass
class _FakePatient:
    id: int
    name: str


@dataclass
class _FakeDoctor:
    username: str
    full_name: str

    def get_full_name(self):
        return self.full_name


@dataclass
class _FakeEcho:
    id: int
    description: str
    uploaded_at: datetime


class _FakeStatus:
    READY = "READY"


class _FakeReport:
    Status = _FakeStatus

    def __init__(self):
        self.id = 11
        self.patient = _FakePatient(id=7, name="Maria Santos")
        self.patient_id = self.patient.id
        self.doctor = _FakeDoctor(username="dr.silva", full_name="Dr. Silva")
        self.echocardiogram = _FakeEcho(
            id=15,
            description="Ecocardiograma Basal",
            uploaded_at=datetime(2026, 4, 23, 10, 30),
        )
        self.echocardiogram_id = self.echocardiogram.id
        self.status = "READY"
        self.content = {
            "identification": {
                "title": "Identificação do paciente e do exame",
                "items": [
                    {"label": "Nome do paciente", "value": "Maria Santos"},
                    {"label": "Identificador", "value": "7"},
                ],
            },
            "summary": {
                "title": "Resumo automático da análise",
                "ai_result": "Calcificação presente",
                "calcification_presence": "Presente",
                "classification": "Moderada",
                "context_note": "Texto automático para validação clínica.",
                "highlights": [
                    {"label": "Frames totais", "value": "12"},
                    {"label": "Índice de calcificação", "value": "41.2%"},
                ],
            },
            "findings": {
                "title": "Achados / observações da válvula",
                "items": [
                    {"label": "Estado da válvula", "value": "Achados compatíveis com calcificação valvular."},
                ],
            },
            "metrics": {
                "title": "Medições / métricas",
                "rows": [
                    {"label": "Índice de calcificação (VO)", "value": "41.2%"},
                    {"label": "Frames com ROI válida", "value": "12"},
                ],
            },
            "validation": {
                "title": "Validação e edição pelo utilizador",
                "status": "Validado",
                "generated_note": "Conteúdo automático separado da revisão manual.",
            },
            "conclusion": {
                "title": "Conclusão clínica",
                "suggested_text": "Sugestão clínica automática.",
            },
        }
        self.source_snapshot = {"annotated_frames": 12}
        self.validated_summary = "Síntese revista pelo utilizador."
        self.clinical_notes = "Sem limitações técnicas relevantes."
        self.clinical_conclusion = "Conclusão clínica final pronta para arquivo."
        self.pdf_file = None


class ClinicalReportUtilitiesTests(unittest.TestCase):
    def test_clean_clinical_notes_hides_placeholder_content(self):
        for value in ("", " ", ".", "..", "Olá", "teste"):
            self.assertEqual(_clean_clinical_notes(value), "Sem observações adicionais.")

        self.assertEqual(
            _clean_clinical_notes("Janela acústica limitada."),
            "Janela acústica limitada.",
        )

    def test_auto_conclusion_identifies_ai_and_clinical_validation(self):
        conclusion = _build_auto_conclusion(False, "Baixa", "Baixo", 4.2)

        self.assertIn("assistida por inteligência artificial", conclusion)
        self.assertIn("4.2%", conclusion)
        self.assertIn("validação do profissional responsável", conclusion)

    def test_frame_results_have_valid_roi_detects_real_annotations(self):
        self.assertTrue(
            frame_results_have_valid_roi(
                [
                    {"frame_id": 1, "rects": []},
                    {"frame_id": 2, "rects": [{"x": 12, "y": 8, "width": 30, "height": 20}]},
                ]
            )
        )
        self.assertFalse(
            frame_results_have_valid_roi(
                [
                    {"frame_id": 1, "rects": []},
                    {"frame_id": 2, "rects": []},
                ]
            )
        )

    def test_build_report_filename_ends_with_pdf(self):
        report = _FakeReport()
        filename = build_report_filename(report)
        self.assertTrue(filename.endswith(".pdf"))
        self.assertIn("maria-santos", filename)

    def test_validate_clinical_report_data_flags_missing_required_fields(self):
        report = _FakeReport()
        report.content = {}
        report.validated_summary = ""
        report.clinical_conclusion = ""
        report.source_snapshot = {"annotated_frames": 0}

        issues = validate_clinical_report_data(report)

        self.assertGreaterEqual(len(issues), 2)
        self.assertFalse(any("síntese validada" in issue.lower() for issue in issues))
        self.assertTrue(any("conclusão clínica final" in issue.lower() for issue in issues))

    def test_render_clinical_report_pdf_returns_pdf_bytes(self):
        report = _FakeReport()
        pdf_bytes = render_clinical_report_pdf(report)

        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 1024)

    def test_render_clinical_report_pdf_accepts_transient_report_without_status_enum(self):
        base_report = _FakeReport()
        transient_report = TransientClinicalReport(
            id=base_report.id,
            patient=base_report.patient,
            doctor=base_report.doctor,
            echocardiogram=base_report.echocardiogram,
            status="READY",
            content=base_report.content,
            source_snapshot=base_report.source_snapshot,
            validated_summary=base_report.validated_summary,
            clinical_notes=base_report.clinical_notes,
            clinical_conclusion=base_report.clinical_conclusion,
        )

        pdf_bytes = render_clinical_report_pdf(transient_report)

        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 1024)
