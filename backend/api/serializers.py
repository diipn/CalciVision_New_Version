from django.http import HttpRequest
from django.core.files.storage import default_storage
from rest_framework import serializers

from authentication.serializers import UserSerializer

from .models import ClinicalReport, Echocardiogram, EchoFrame, EchoFrameData, Patient
from .reporting import (
    build_legacy_patient_reports,
    build_report_filename,
    is_clinical_report_schema_ready,
    is_legacy_report_schema_ready,
    list_legacy_report_records,
    validate_clinical_report_data,
)

import logging


logger = logging.getLogger(__name__)


def _safe_report_echocardiogram(obj):
    try:
        return getattr(obj, 'echocardiogram', None)
    except Exception:
        return None


class EchocardiogramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Echocardiogram
        fields = [
            'id',
            'patient',
            'uploaded_at',
            'description',
            'status',
            'vo',
            'vo_frame_count',
            'vo_white_pixels',
            'vo_gray_pixels',
            'vo_roi_pixels',
            'vo_metadata',
        ]


class ClinicalReportSummarySerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)
    is_exportable = serializers.SerializerMethodField()
    validation_issues = serializers.SerializerMethodField()
    exam_description = serializers.SerializerMethodField()
    exam_date = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    has_calcification = serializers.SerializerMethodField()
    hasCalcification = serializers.SerializerMethodField()
    summary_label = serializers.SerializerMethodField()
    download_filename = serializers.SerializerMethodField()
    report_url = serializers.SerializerMethodField()

    class Meta:
        model = ClinicalReport
        fields = [
            'id',
            'patient',
            'doctor',
            'echocardiogram',
            'status',
            'pdf_name',
            'pdf_size',
            'is_exportable',
            'validation_issues',
            'exam_description',
            'exam_date',
            'patient_name',
            'has_calcification',
            'hasCalcification',
            'summary_label',
            'download_filename',
            'report_url',
            'updated_at',
            'validated_at',
        ]

    def get_is_exportable(self, obj):
        return obj.status == ClinicalReport.Status.READY and not validate_clinical_report_data(obj)

    def get_validation_issues(self, obj):
        return validate_clinical_report_data(obj)

    def get_exam_description(self, obj):
        echocardiogram = _safe_report_echocardiogram(obj)
        if not obj.echocardiogram_id or echocardiogram is None:
            return 'Exame legado sem associação'
        return echocardiogram.description or f'Ecocardiograma #{obj.echocardiogram_id}'

    def get_exam_date(self, obj):
        echocardiogram = _safe_report_echocardiogram(obj)
        if echocardiogram is None or not getattr(echocardiogram, 'uploaded_at', None):
            return None
        return echocardiogram.uploaded_at.date().isoformat()

    def get_patient_name(self, obj):
        return obj.patient.name

    def get_has_calcification(self, obj):
        calcification_present = obj.source_snapshot.get('calcification_present')
        if calcification_present is not None:
            return calcification_present
        echocardiogram = getattr(obj, 'echocardiogram', None)
        if echocardiogram and echocardiogram.vo is not None:
            vo_value = echocardiogram.vo * 100 if echocardiogram.vo <= 1 else echocardiogram.vo
            return vo_value >= 30
        return None

    def get_hasCalcification(self, obj):
        return self.get_has_calcification(obj)

    def get_summary_label(self, obj):
        return obj.content.get('summary', {}).get('ai_result')

    def get_download_filename(self, obj):
        try:
            return build_report_filename(obj)
        except Exception:
            patient_name = getattr(getattr(obj, 'patient', None), 'name', None) or f'paciente-{getattr(obj, "patient_id", "desconhecido")}'
            patient_slug = patient_name.lower().replace(' ', '-')
            return f'relatorio_clinico_{patient_slug}_exame-{getattr(obj, "echocardiogram_id", getattr(obj, "id", "desconhecido"))}.pdf'

    def get_report_url(self, obj):
        request: HttpRequest = self.context.get('request')
        pdf_file = getattr(obj, 'pdf_file', None)
        if not pdf_file:
            return None

        try:
            if hasattr(pdf_file, 'url'):
                return request.build_absolute_uri(pdf_file.url) if request else pdf_file.url

            url = default_storage.url(str(pdf_file))
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


class ClinicalReportDetailSerializer(ClinicalReportSummarySerializer):
    class Meta(ClinicalReportSummarySerializer.Meta):
        fields = ClinicalReportSummarySerializer.Meta.fields + [
            'content',
            'source_snapshot',
            'validated_summary',
            'clinical_notes',
            'clinical_conclusion',
            'generation_error',
            'created_at',
            'pdf_generated_at',
        ]


class PatientSerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)
    echocardiograms = EchocardiogramSerializer(many=True, read_only=True)
    reports = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = '__all__'
        extra_kwargs = {
            'doctor': {'read_only': True},
            'echocardiograms': {'read_only': True},
        }

    def get_reports(self, obj):
        if is_clinical_report_schema_ready():
            try:
                serializer = ClinicalReportSummarySerializer(
                    obj.reports.filter(status=ClinicalReport.Status.READY),
                    many=True,
                    context=self.context,
                )
                return serializer.data
            except Exception:
                logger.exception("Falha a serializar relatórios clínicos do paciente", extra={"patient_id": obj.id})
                return []

        if not is_legacy_report_schema_ready():
            return []

        request: HttpRequest = self.context.get('request')
        doctor = getattr(request, 'user', None)
        if not doctor or not getattr(doctor, 'is_authenticated', False):
            return []

        records = list_legacy_report_records(doctor_id=doctor.id, patient_id=obj.id)
        transient_reports = build_legacy_patient_reports(
            patient=obj,
            doctor=doctor,
            records=records,
            echocardiograms=list(obj.echocardiograms.all()),
        )
        try:
            serializer = ClinicalReportSummarySerializer(transient_reports, many=True, context=self.context)
            return serializer.data
        except Exception:
            logger.exception("Falha a serializar relatórios legados do paciente", extra={"patient_id": obj.id})
            return []


class PatientWithEchocardiogramSerializer(serializers.ModelSerializer):
    echocardiograms = EchocardiogramSerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'echocardiograms']


class FrameDataSerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)

    class Meta:
        model = EchoFrameData
        fields = [
            'doctor',
            'frame',
            'x',
            'y',
            'width',
            'height',
            'is_calcified',
            'confidence',
            'is_annotation_generated',
            'is_calcification_generated',
            'objective_variable',
            'white_pixel_count',
            'gray_pixel_count',
            'valid_pixel_count',
        ]


class EcoFrameSerializer(serializers.ModelSerializer):
    data = FrameDataSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = EchoFrame
        fields = ['id', 'frame_index', 'image_url', 'data']

    def get_image_url(self, obj):
        request: HttpRequest = self.context.get('request')
        return request.build_absolute_uri(obj.image.url)


class AnnotationSerializer(serializers.Serializer):
    x = serializers.FloatField()
    y = serializers.FloatField()
    width = serializers.FloatField()
    height = serializers.FloatField()
    id = serializers.CharField()
    is_annotation_generated = serializers.BooleanField()


class FrameResultsSerializer(serializers.Serializer):
    frame_id = serializers.IntegerField()
    rects = AnnotationSerializer(many=True)
    is_calcified = serializers.BooleanField(allow_null=True, required=False)
    generated_calcium = serializers.BooleanField(allow_null=True, required=False)


class EchoFrameDataSerializer(serializers.ModelSerializer):
    rects = serializers.SerializerMethodField()

    class Meta:
        model = EchoFrameData
        fields = [
            'frame',
            'rects',
            'is_calcified',
            'confidence',
            'objective_variable',
            'white_pixel_count',
            'gray_pixel_count',
            'valid_pixel_count',
        ]

    def get_rects(self, obj):
        return {
            "x": obj.x,
            "y": obj.y,
            "width": obj.width,
            "height": obj.height,
        }


class ClinicalReportUpsertSerializer(serializers.Serializer):
    results = FrameResultsSerializer(many=True, required=False)
    classification_choice = serializers.BooleanField(required=False, allow_null=True)
    validated_summary = serializers.CharField(required=False, allow_blank=True)
    clinical_notes = serializers.CharField(required=False, allow_blank=True)
    clinical_conclusion = serializers.CharField(required=False, allow_blank=True)
    mark_ready = serializers.BooleanField(required=False, default=False)
