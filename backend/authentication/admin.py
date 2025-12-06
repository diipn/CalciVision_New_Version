from django.contrib import admin
from .models import CustomUser as User

# Adiciona o modelo de utilizador personalizado ao painel de administração
admin.site.register(User)
