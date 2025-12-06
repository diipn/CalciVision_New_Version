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
    
    def __str__(self):
        return f"Data for frame {self.frame.frame_index} of {self.frame.echocardiogram.patient.name}"

class ReportPdf(models.Model):
    patient = models.ForeignKey(to=Patient, on_delete=models.CASCADE, related_name='reports')
    doctor = models.ForeignKey(to=CustomUser, on_delete=models.CASCADE, related_name='reports')
    pdf_file = models.FileField(upload_to='reports/')
    
    @property
    def pdf_name(self):
        return self.pdf_file.name.split('/')[-1]
    
    @property
    def pdf_size(self):
        if self.pdf_file and hasattr(self.pdf_file, 'size'):
            return round(self.pdf_file.size / 1024, 2)
        return 0

    def __str__(self):
        return f"Report for {self.patient.name} by {self.doctor.username}"
    