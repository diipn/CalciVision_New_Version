from django.db.models.signals import post_delete
from django.dispatch import receiver
from api.models import ClinicalReport, Echocardiogram
from django.conf import settings
import shutil
import os

# Com signals, os ficheiros .jpg e .dcm são removidos automaticamente via signal quando se apaga a entrada correspondente na base de dados.

@receiver(post_delete, sender=Echocardiogram)
def delete_dicom_file(sender, instance: Echocardiogram, **kwargs):
    """Apaga os ficheiros físicos do DICOM e dos frames quando um ecocardiograma é removido da base de dados"""
    
    if instance.dicom_file and os.path.isfile(instance.dicom_file.path):
        os.remove(instance.dicom_file.path)
    
    # Apaga a pasta dos frames e todos os ficheiros lá dentro
    dicom_name = instance.dicom_file.name.split('/')[-1].split('.')[0]
    frame_folder = os.path.join(settings.MEDIA_ROOT, 'frames', dicom_name)
    if os.path.exists(frame_folder):
        shutil.rmtree(frame_folder)

@receiver(post_delete, sender=ClinicalReport)
def delete_report_file(sender, instance: ClinicalReport, **kwargs):
    """Apaga o ficheiro físico do PDFs quando um report é removido da base de dados"""
    if instance.pdf_file and os.path.isfile(instance.pdf_file.path):
        os.remove(instance.pdf_file.path)
