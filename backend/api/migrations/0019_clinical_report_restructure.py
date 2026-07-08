import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


def backfill_clinical_reports(apps, schema_editor):
    ClinicalReport = apps.get_model("api", "ClinicalReport")
    Echocardiogram = apps.get_model("api", "Echocardiogram")

    for report in ClinicalReport.objects.all():
        if report.echocardiogram_id is None:
            patient_echos = list(
                Echocardiogram.objects.filter(patient_id=report.patient_id).order_by("uploaded_at", "id")[:2]
            )
            if len(patient_echos) == 1:
                report.echocardiogram_id = patient_echos[0].id

        if report.pdf_file:
            report.status = "READY"
        elif report.status not in {"DRAFT", "READY", "FAILED"}:
            report.status = "DRAFT"

        if report.content is None:
            report.content = {}
        if report.source_snapshot is None:
            report.source_snapshot = {}

        report.save(
            update_fields=[
                "echocardiogram",
                "status",
                "content",
                "source_snapshot",
                "updated_at",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0018_objective_variable_schema_alignment"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="ReportPdf",
            new_name="ClinicalReport",
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="echocardiogram",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clinical_report",
                to="api.echocardiogram",
            ),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Draft"),
                    ("READY", "Ready"),
                    ("FAILED", "Failed"),
                ],
                default="DRAFT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="content",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="source_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="validated_summary",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="clinical_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="clinical_conclusion",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="generation_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="validated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="clinicalreport",
            name="pdf_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="clinicalreport",
            name="pdf_file",
            field=models.FileField(blank=True, null=True, upload_to="reports/"),
        ),
        migrations.RunPython(backfill_clinical_reports, migrations.RunPython.noop),
    ]
