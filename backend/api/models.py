from django.db import models
from authentication.models import CustomUser
from .utils import frame_image_upload_path

# Minuto 32:36 - modelos com permissões

class Patient(models.Model):
    
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        EVALUATED = 'EVALUATED', 'Evaluated'
    
    doctor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='patients')
    name = models.CharField(max_length=100)
    birth_date = models.DateField()
    age = models.IntegerField()
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Others')]
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    health_plan = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    has_report = models.BooleanField(blank=True, default=False)
    
    def __str__(self):
        return self.name

class Echocardiogram(models.Model):
    
    class Status(models.TextChoices):
        REVIEW_NEEDED = 'REVIEW_NEEDED', 'Review Needed'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress',
        EVALUATED = 'EVALUATED', 'Evaluated'
    
    patient = models.ForeignKey(to=Patient, on_delete=models.CASCADE, related_name='echocardiograms')
    dicom_file = models.FileField(upload_to='dicom/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True, null=True)
    vo = models.FloatField(blank=True, null=True)
    vo_frame_count = models.PositiveIntegerField(default=0)
    vo_white_pixels = models.PositiveIntegerField(default=0)
    vo_gray_pixels = models.PositiveIntegerField(default=0)
    vo_roi_pixels = models.PositiveIntegerField(default=0)
    vo_metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REVIEW_NEEDED)

    def __str__(self):
        return f"Echocardiogram of {self.patient.name} - {self.uploaded_at}"
        
class EchoFrame(models.Model):
    echocardiogram = models.ForeignKey(to=Echocardiogram, on_delete=models.CASCADE, related_name='frames')
    image = models.FileField(upload_to=frame_image_upload_path)
    frame_index = models.PositiveIntegerField()
        
    def __str__(self):
        return f"Frame {self.frame_index} of {self.echocardiogram.patient.name}"

class EchoFrameData(models.Model):
    frame = models.ForeignKey(to=EchoFrame, on_delete=models.CASCADE, related_name='data')
    doctor = models.ForeignKey(to=CustomUser, on_delete=models.CASCADE, related_name='doctor')
    x = models.FloatField()
    y = models.FloatField()
    width = models.FloatField()
    height = models.FloatField()
    is_calcified = models.BooleanField(blank=True, null=True)
    confidence = models.FloatField(default=0.0, blank=True)
    is_annotation_generated = models.BooleanField(null=True)
    is_calcification_generated = models.BooleanField(null=True)
    objective_variable = models.FloatField(blank=True, null=True)
    white_pixel_count = models.PositiveIntegerField(blank=True, null=True)
    gray_pixel_count = models.PositiveIntegerField(blank=True, null=True)
    valid_pixel_count = models.PositiveIntegerField(blank=True, null=True)
    
    def __str__(self):
        return f"Data for frame {self.frame.frame_index} of {self.frame.echocardiogram.patient.name}"

<<<<<<< Updated upstream
class ClinicalReport(models.Model):

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
=======
class ReportPdf(models.Model):
    class Status(models.TextChoices):
        AUTO_GENERATED = 'AUTO_GENERATED', 'Auto Generated'
        USER_REVIEWED = 'USER_REVIEWED', 'User Reviewed'
>>>>>>> Stashed changes
        READY = 'READY', 'Ready'
        FAILED = 'FAILED', 'Failed'

    patient = models.ForeignKey(to=Patient, on_delete=models.CASCADE, related_name='reports')
    echocardiogram = models.OneToOneField(
        to=Echocardiogram,
        on_delete=models.CASCADE,
        related_name='clinical_report',
        blank=True,
        null=True,
    )
    doctor = models.ForeignKey(to=CustomUser, on_delete=models.CASCADE, related_name='reports')
<<<<<<< Updated upstream
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    content = models.JSONField(default=dict, blank=True)
    source_snapshot = models.JSONField(default=dict, blank=True)
    validated_summary = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)
    clinical_conclusion = models.TextField(blank=True)
    generation_error = models.TextField(blank=True)
    pdf_file = models.FileField(upload_to='reports/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    validated_at = models.DateTimeField(blank=True, null=True)
    pdf_generated_at = models.DateTimeField(blank=True, null=True)
    
=======
    echocardiogram = models.ForeignKey(
        to=Echocardiogram,
        on_delete=models.CASCADE,
        related_name='reports',
        blank=True,
        null=True,
    )
    title = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AUTO_GENERATED)
    report_data = models.JSONField(default=dict, blank=True)
    has_calcification = models.BooleanField(blank=True, null=True)
    objective_variable = models.FloatField(blank=True, null=True)
    last_error = models.TextField(blank=True, default='')
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    validated_at = models.DateTimeField(blank=True, null=True)
    pdf_generated_at = models.DateTimeField(blank=True, null=True)
    pdf_file = models.FileField(upload_to='reports/', blank=True, null=True)

>>>>>>> Stashed changes
    @property
    def pdf_name(self):
        if not self.pdf_file:
            return ''
        return self.pdf_file.name.split('/')[-1]
    
    @property
    def pdf_size(self):
        if self.pdf_file and hasattr(self.pdf_file, 'size'):
            return round(self.pdf_file.size / 1024, 2)
        return 0

    @property
    def has_pdf(self):
        return bool(self.pdf_file)

    def __str__(self):
<<<<<<< Updated upstream
        exam_id = self.echocardiogram_id or 'legacy'
        return f"Clinical report {self.id} for {self.patient.name} / exam {exam_id}"
=======
        return f"Report for {self.patient.name} by {self.doctor.username}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['patient', 'doctor', 'echocardiogram'],
                name='unique_report_per_exam_and_doctor',
            )
        ]
>>>>>>> Stashed changes
    
