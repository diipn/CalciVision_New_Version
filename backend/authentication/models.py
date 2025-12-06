from django.db import models
from django.contrib.auth.models import AbstractUser

# Cria um modelo de utilizador AbstractUser que estende o modelo de utilizador padrão do Django
class CustomUser(AbstractUser):
    medical_speciality = models.CharField(max_length=255, blank=True, null=True)
    doctor_number = models.CharField(max_length=255, blank=True, null=True)
    
    def __str__(self):
        return self.username

# Minuto 32:36 - modelos com permissões